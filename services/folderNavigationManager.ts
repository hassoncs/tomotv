import {fetchFolderContents} from "@/services/jellyfinApi"
import {FolderStackEntry, JellyfinItem} from "@/types/jellyfin"
import {logger} from "@/utils/logger"

type FolderNavigationListener = (data: {
  items: JellyfinItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMoreResults: boolean
  error: string | null
  folderStack: FolderStackEntry[]
  currentFolder: FolderStackEntry | null
}) => void

/**
 * Singleton service for managing folder navigation with caching and pagination
 */
class FolderNavigationManager {
  private static instance: FolderNavigationManager

  private items: JellyfinItem[] = []
  private isLoading: boolean = false
  private isLoadingMore: boolean = false
  private hasMoreResults: boolean = false
  private error: string | null = null

  private folderStack: FolderStackEntry[] = []

  private nextStartIndex: number = 0
  private totalRecordCount: number | undefined = undefined
  private isLoadingRef: boolean = false

  private folderCache: Map<
    string,
    {
      items: JellyfinItem[]
      total?: number
      timestamp: number
    }
  > = new Map()

  private listeners: Set<FolderNavigationListener> = new Set()

  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly PAGE_SIZE = 60

  private constructor() {}

  static getInstance(): FolderNavigationManager {
    if (!FolderNavigationManager.instance) {
      FolderNavigationManager.instance = new FolderNavigationManager()
    }
    return FolderNavigationManager.instance
  }

  subscribe(listener: FolderNavigationListener): () => void {
    this.listeners.add(listener)

    logger.debug("Folder navigation subscriber added", {
      service: "FolderNavigationManager",
      totalSubscribers: this.listeners.size
    })

    listener(this.getState())

    return () => {
      this.listeners.delete(listener)
      logger.debug("Folder navigation subscriber removed", {
        service: "FolderNavigationManager",
        totalSubscribers: this.listeners.size
      })
    }
  }

  private notifyListeners(): void {
    const state = this.getState()
    this.listeners.forEach(listener => listener(state))
  }

  getState() {
    return {
      items: this.items,
      isLoading: this.isLoading,
      isLoadingMore: this.isLoadingMore,
      hasMoreResults: this.hasMoreResults,
      error: this.error,
      folderStack: this.folderStack,
      currentFolder:
        this.folderStack.length > 0 ? this.folderStack[this.folderStack.length - 1] : null
    }
  }

  /**
   * Navigate to a folder (push onto stack)
   */
  async navigateToFolder(folder: FolderStackEntry): Promise<void> {
    logger.info("Navigating to folder", {
      service: "FolderNavigationManager",
      folderId: folder.id,
      folderName: folder.name
    })

    // Create new array reference for React state detection
    this.folderStack = [...this.folderStack, folder]
    await this.loadFolderContents(folder.id)
  }

  /**
   * Navigate back to parent folder (pop from stack)
   */
  async navigateBack(): Promise<boolean> {
    if (this.folderStack.length === 0) {
      logger.debug("Already at library selection, cannot navigate back", {
        service: "FolderNavigationManager"
      })
      return false
    }

    if (this.folderStack.length === 1) {
      // At library root - go back to library selection
      logger.info("Navigating back to library selection", {
        service: "FolderNavigationManager"
      })
      this.folderStack = []
      await this.loadFolderContents(null)
      return true
    }

    // Create new array reference for React state detection (remove last item)
    this.folderStack = this.folderStack.slice(0, -1)
    const parentFolder = this.folderStack[this.folderStack.length - 1]

    logger.info("Navigating back to parent", {
      service: "FolderNavigationManager",
      parentId: parentFolder?.id,
      parentName: parentFolder?.name
    })

    await this.loadFolderContents(parentFolder?.id || null)
    return true
  }

  /**
   * Navigate to specific breadcrumb level
   */
  async navigateToBreadcrumb(index: number): Promise<void> {
    if (index < 0 || index >= this.folderStack.length) {
      return
    }

    logger.info("Navigating to breadcrumb", {
      service: "FolderNavigationManager",
      index,
      folderName: this.folderStack[index]?.name
    })

    this.folderStack = this.folderStack.slice(0, index + 1)
    const targetFolder = this.folderStack[index]
    await this.loadFolderContents(targetFolder?.id || null)
  }

  /**
   * Load root level and auto-navigate into first library
   */
  async loadRoot(): Promise<void> {
    logger.info("Loading root libraries", {
      service: "FolderNavigationManager"
    })

    // Start with empty stack (library selection state)
    this.folderStack = []
    await this.loadFolderContents(null)

    // Auto-navigate into first library if available
    if (this.items.length > 0) {
      const firstLibrary = this.items[0]
      logger.info("Auto-navigating into first library", {
        service: "FolderNavigationManager",
        libraryId: firstLibrary.Id,
        libraryName: firstLibrary.Name
      })

      // Library becomes the root of the stack
      this.folderStack = [
        {
          id: firstLibrary.Id,
          name: firstLibrary.Name,
          parentId: firstLibrary.ParentId
        }
      ]
      await this.loadFolderContents(firstLibrary.Id)
    }
  }

  /**
   * Load folder contents with caching
   */
  private async loadFolderContents(folderId: string | null): Promise<void> {
    if (this.isLoadingRef) {
      return
    }

    const cacheKey = folderId || "root"
    const cached = this.folderCache.get(cacheKey)
    const now = Date.now()

    // Check cache
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      logger.debug("Using cached folder contents", {
        service: "FolderNavigationManager",
        cacheKey,
        itemCount: cached.items.length
      })

      this.items = cached.items
      this.hasMoreResults = cached.total !== undefined && cached.items.length < cached.total
      this.nextStartIndex = cached.items.length
      this.totalRecordCount = cached.total
      this.notifyListeners()
      return
    }

    try {
      this.isLoadingRef = true
      this.isLoading = true
      this.error = null
      this.nextStartIndex = 0
      this.notifyListeners()

      logger.info("Loading folder contents", {
        service: "FolderNavigationManager",
        folderId: cacheKey
      })

      const {items, total} = await fetchFolderContents(folderId, {
        limit: this.PAGE_SIZE,
        startIndex: 0
      })

      this.items = items
      this.totalRecordCount = total
      this.nextStartIndex = items.length
      this.hasMoreResults = total !== undefined && items.length < total

      // Update cache
      this.folderCache.set(cacheKey, {
        items,
        total,
        timestamp: now
      })

      this.isLoading = false
      this.notifyListeners()

      logger.info("Successfully loaded folder contents", {
        service: "FolderNavigationManager",
        itemCount: items.length,
        total,
        hasMore: this.hasMoreResults
      })
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load folder"
      this.isLoading = false
      this.notifyListeners()

      logger.error("Error loading folder contents", err, {
        service: "FolderNavigationManager"
      })
    } finally {
      this.isLoadingRef = false
    }
  }

  /**
   * Load more items (pagination)
   */
  async loadMore(): Promise<void> {
    if (this.isLoadingMore || this.isLoading || !this.hasMoreResults) {
      return
    }

    const currentFolder = this.folderStack[this.folderStack.length - 1]
    const folderId = currentFolder?.id || null

    try {
      this.isLoadingMore = true
      this.notifyListeners()

      logger.info("Loading more folder items", {
        service: "FolderNavigationManager",
        startIndex: this.nextStartIndex
      })

      const {items, total} = await fetchFolderContents(folderId || null, {
        limit: this.PAGE_SIZE,
        startIndex: this.nextStartIndex
      })

      // If no new items returned, we've reached the end
      if (items.length === 0) {
        this.hasMoreResults = false
        this.isLoadingMore = false
        this.notifyListeners()
        logger.info("No more items to load", {
          service: "FolderNavigationManager",
          totalLoaded: this.items.length
        })
        return
      }

      this.items = [...this.items, ...items]
      this.totalRecordCount = total
      this.nextStartIndex += items.length
      this.hasMoreResults = total !== undefined && this.items.length < total

      // Update cache
      const cacheKey = folderId || "root"
      this.folderCache.set(cacheKey, {
        items: this.items,
        total,
        timestamp: Date.now()
      })

      this.isLoadingMore = false
      this.notifyListeners()

      logger.info("Successfully loaded more folder items", {
        service: "FolderNavigationManager",
        newItems: items.length,
        totalLoaded: this.items.length
      })
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load more"
      this.isLoadingMore = false
      this.notifyListeners()

      logger.error("Error loading more folder items", err, {
        service: "FolderNavigationManager"
      })
    }
  }

  /**
   * Force refresh current folder
   */
  async refresh(): Promise<void> {
    const currentFolder = this.folderStack[this.folderStack.length - 1]
    const folderId = currentFolder?.id || null
    const cacheKey = folderId || "root"

    logger.info("Refreshing folder contents", {
      service: "FolderNavigationManager",
      cacheKey
    })

    this.folderCache.delete(cacheKey)
    await this.loadFolderContents(folderId || null)
  }

  /**
   * Clear all state and cache
   */
  clearCache(): void {
    this.items = []
    this.folderStack = []
    this.folderCache.clear()
    this.error = null
    this.isLoadingRef = false
    this.nextStartIndex = 0
    this.hasMoreResults = false
    this.totalRecordCount = undefined
    this.notifyListeners()

    logger.info("Folder navigation cache cleared", {
      service: "FolderNavigationManager"
    })
  }
}

export const folderNavigationManager = FolderNavigationManager.getInstance()
