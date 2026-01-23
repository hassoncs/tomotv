//
//  MultiAudioResourceLoader.swift
//  TomoTV
//
//  Created on January 23, 2026.
//  Custom HLS manifest generator for seamless multi-audio track switching
//

import Foundation
import React

@objc(MultiAudioResourceLoader)
class MultiAudioResourceLoader: NSObject {

    // MARK: - Properties

    private var jellyfinBaseUrl: String = ""
    private var apiKey: String = ""
    private var itemId: String = ""
    private var audioTrackInfo: [[String: Any]] = []

    private let session = URLSession.shared
    private let queue = DispatchQueue(label: "com.tomotv.multiaudio", qos: .userInitiated)
    private let fileManager = FileManager.default

    // MARK: - React Native Bridge Methods

    @objc
    func configureResourceLoader(
        _ baseUrl: String,
        apiKey key: String,
        itemId id: String,
        audioTracks tracks: [[String: Any]],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        queue.async {
            self.jellyfinBaseUrl = baseUrl
            self.apiKey = key
            self.itemId = id
            self.audioTrackInfo = tracks

            DispatchQueue.main.async {
                resolve(true)
            }
        }
    }

    @objc
    func generateCustomUrl(
        _ itemId: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        queue.async {
            do {
                NSLog("[MultiAudioResourceLoader] Generating combined manifest for item: \(itemId)")

                // 1. Fetch all Jellyfin manifests (one per audio track)
                let manifests = try self.fetchAllManifests()

                NSLog("[MultiAudioResourceLoader] Fetched \(manifests.count) manifests")

                // 2. Generate combined multivariant manifest
                let combinedManifest = try self.generateMultivariantManifest(from: manifests)

                NSLog("[MultiAudioResourceLoader] Generated combined manifest (\(combinedManifest.count) bytes)")

                // 3. Write to temporary file
                let fileUrl = try self.writeManifestToTempFile(combinedManifest, itemId: itemId)

                NSLog("[MultiAudioResourceLoader] Wrote manifest to: \(fileUrl.path)")

                DispatchQueue.main.async {
                    resolve(fileUrl.absoluteString)
                }

            } catch {
                NSLog("[MultiAudioResourceLoader] Error: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    reject("MANIFEST_ERROR", "Failed to generate manifest: \(error.localizedDescription)", error)
                }
            }
        }
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Private Methods

    private func fetchAllManifests() throws -> [String] {
        var manifests: [String] = []

        for (index, _) in audioTrackInfo.enumerated() {
            let manifestUrl = buildManifestUrl(audioStreamIndex: index)

            NSLog("[MultiAudioResourceLoader] Fetching manifest \(index + 1)/\(audioTrackInfo.count)")

            // Fetch manifest synchronously (we're already on background queue)
            let manifest = try fetchManifest(from: manifestUrl)
            manifests.append(manifest)
        }

        return manifests
    }

    private func buildManifestUrl(audioStreamIndex: Int) -> String {
        // Parse base URL and add audioStreamIndex parameter
        guard var components = URLComponents(string: jellyfinBaseUrl) else {
            return jellyfinBaseUrl
        }

        // Append audioStreamIndex to existing query items
        var queryItems = components.queryItems ?? []
        queryItems.append(URLQueryItem(name: "audioStreamIndex", value: "\(audioStreamIndex)"))

        components.queryItems = queryItems

        return components.url?.absoluteString ?? jellyfinBaseUrl
    }

    private func fetchManifest(from urlString: String) throws -> String {
        guard let url = URL(string: urlString) else {
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Invalid manifest URL"]
            )
        }

        let semaphore = DispatchSemaphore(value: 0)
        var result: String?
        var fetchError: Error?

        let task = session.dataTask(with: url) { data, response, error in
            if let error = error {
                fetchError = error
            } else if let data = data, let manifestString = String(data: data, encoding: .utf8) {
                result = manifestString
            } else {
                fetchError = NSError(
                    domain: "MultiAudioResourceLoader",
                    code: 4,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to decode manifest"]
                )
            }
            semaphore.signal()
        }

        task.resume()

        // Wait for request to complete (with timeout)
        let timeout = DispatchTime.now() + .seconds(30)
        if semaphore.wait(timeout: timeout) == .timedOut {
            task.cancel()
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "Manifest fetch timeout"]
            )
        }

        if let error = fetchError {
            throw error
        }

        guard let manifest = result else {
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 6,
                userInfo: [NSLocalizedDescriptionKey: "No manifest data received"]
            )
        }

        return manifest
    }

    private func generateMultivariantManifest(from manifests: [String]) throws -> Data {
        let generator = HLSManifestGenerator()

        let combinedManifestString = try generator.combine(
            manifests: manifests,
            audioTrackInfo: audioTrackInfo,
            baseUrl: jellyfinBaseUrl
        )

        guard let data = combinedManifestString.data(using: .utf8) else {
            throw NSError(
                domain: "MultiAudioResourceLoader",
                code: 7,
                userInfo: [NSLocalizedDescriptionKey: "Failed to encode manifest to UTF-8"]
            )
        }

        return data
    }

    private func writeManifestToTempFile(_ data: Data, itemId: String) throws -> URL {
        // Get temp directory
        let tempDir = fileManager.temporaryDirectory

        // Create unique filename
        let fileName = "multi-audio-\(itemId).m3u8"
        let fileUrl = tempDir.appendingPathComponent(fileName)

        // Remove old file if exists
        try? fileManager.removeItem(at: fileUrl)

        // Write manifest to file
        try data.write(to: fileUrl, options: .atomic)

        return fileUrl
    }
}
