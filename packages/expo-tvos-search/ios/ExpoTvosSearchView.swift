import ExpoModulesCore
import SwiftUI

#if os(tvOS)
import TVUIKit

struct SearchResultItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let imageUrl: String?
}

struct TvosSearchContentView: View {
    @Binding var searchText: String
    let results: [SearchResultItem]
    let columns: Int
    let placeholder: String
    let onSearch: (String) -> Void
    let onSelectItem: (String) -> Void

    private var gridColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 40), count: columns)
    }

    var body: some View {
        NavigationStack {
            Group {
                if results.isEmpty && searchText.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 80))
                            .foregroundColor(.secondary)
                        Text("Search for movies and videos")
                            .font(.headline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if results.isEmpty && !searchText.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "film.stack")
                            .font(.system(size: 80))
                            .foregroundColor(.secondary)
                        Text("No results found")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text("Try a different search term")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVGrid(columns: gridColumns, spacing: 50) {
                            ForEach(results) { item in
                                SearchResultCard(
                                    item: item,
                                    onSelect: { onSelectItem(item.id) }
                                )
                            }
                        }
                        .padding(.horizontal, 60)
                        .padding(.vertical, 40)
                    }
                }
            }
            .searchable(text: $searchText, prompt: placeholder)
            .onChange(of: searchText) { oldValue, newValue in
                onSearch(newValue)
            }
        }
    }
}

struct SearchResultCard: View {
    let item: SearchResultItem
    let onSelect: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    Color(UIColor.systemGray5)

                    if let imageUrl = item.imageUrl, let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .empty:
                                ProgressView()
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            case .failure:
                                Image(systemName: "film")
                                    .font(.system(size: 50))
                                    .foregroundColor(.secondary)
                            @unknown default:
                                EmptyView()
                            }
                        }
                    } else {
                        Image(systemName: "film")
                            .font(.system(size: 50))
                            .foregroundColor(.secondary)
                    }
                }
                .aspectRatio(2/3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.callout)
                        .fontWeight(.medium)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .foregroundColor(.primary)

                    if let subtitle = item.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.card)
        .focused($isFocused)
    }
}

class ExpoTvosSearchView: ExpoView {
    private var hostingController: UIHostingController<TvosSearchContentView>?
    private var searchResults: [SearchResultItem] = []
    private var searchText: String = ""

    var columns: Int = 5 {
        didSet { updateHostingController() }
    }

    var placeholder: String = "Search movies and videos..." {
        didSet { updateHostingController() }
    }

    let onSearch = EventDispatcher()
    let onSelectItem = EventDispatcher()

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        updateHostingController()
    }

    func updateResults(_ results: [[String: Any]]) {
        searchResults = results.compactMap { dict -> SearchResultItem? in
            guard let id = dict["id"] as? String,
                  let title = dict["title"] as? String else {
                return nil
            }
            return SearchResultItem(
                id: id,
                title: title,
                subtitle: dict["subtitle"] as? String,
                imageUrl: dict["imageUrl"] as? String
            )
        }
        updateHostingController()
    }

    private func updateHostingController() {
        hostingController?.view.removeFromSuperview()
        hostingController = nil

        let searchBinding = Binding<String>(
            get: { [weak self] in self?.searchText ?? "" },
            set: { [weak self] newValue in
                self?.searchText = newValue
            }
        )

        let contentView = TvosSearchContentView(
            searchText: searchBinding,
            results: searchResults,
            columns: columns,
            placeholder: placeholder,
            onSearch: { [weak self] query in
                self?.onSearch(["query": query])
            },
            onSelectItem: { [weak self] id in
                self?.onSelectItem(["id": id])
            }
        )

        let controller = UIHostingController(rootView: contentView)
        controller.view.backgroundColor = .clear
        hostingController = controller

        addSubview(controller.view)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            controller.view.topAnchor.constraint(equalTo: topAnchor),
            controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
            controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: trailingAnchor)
        ])
    }
}

#else

// Fallback for non-tvOS platforms (iOS)
class ExpoTvosSearchView: ExpoView {
    var columns: Int = 5
    var placeholder: String = "Search movies and videos..."

    let onSearch = EventDispatcher()
    let onSelectItem = EventDispatcher()

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupFallbackView()
    }

    private func setupFallbackView() {
        let label = UILabel()
        label.text = "TvOS Search View is only available on Apple TV"
        label.textAlignment = .center
        label.textColor = .secondaryLabel
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    func updateResults(_ results: [[String: Any]]) {
        // No-op on non-tvOS
    }
}

#endif
