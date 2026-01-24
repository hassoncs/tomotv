//
//  HLSManifestGenerator.swift
//  TomoTV
//
//  Created on January 23, 2026.
//  Generates multivariant HLS manifests with multiple audio tracks
//

import Foundation

/// Generates combined HLS manifests from multiple Jellyfin manifests
class HLSManifestGenerator {

    /// Combine multiple Jellyfin manifests into a single multivariant manifest
    /// - Parameters:
    ///   - manifests: Array of HLS manifest strings (one per audio track)
    ///   - audioTrackInfo: Audio track metadata from Jellyfin
    ///   - baseUrl: Base Jellyfin URL for generating stream URLs
    /// - Returns: Combined HLS manifest string
    /// - Throws: Error if manifests are empty or malformed
    func combine(
        manifests: [String],
        audioTrackInfo: [[String: Any]],
        baseUrl: String
    ) throws -> String {

        guard !manifests.isEmpty else {
            throw NSError(
                domain: "HLSGenerator",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No manifests provided"]
            )
        }

        guard !audioTrackInfo.isEmpty else {
            throw NSError(
                domain: "HLSGenerator",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "No audio track info provided"]
            )
        }

        // Parse all manifests
        let parser = HLSManifestParser()
        let parsedManifests = try manifests.map { try parser.parse($0) }

        // Extract subtitles from first manifest (they're the same across all audio variants)
        let subtitles = parsedManifests.first?.subtitleTracks ?? []

        // Build combined manifest
        var combined = "#EXTM3U\n"
        combined += "#EXT-X-VERSION:3\n\n"

        // Add subtitle renditions (shared across all stream variants)
        for subtitle in subtitles {
            let absoluteUri = makeAbsoluteUrl(baseUrl: baseUrl, relativeUrl: subtitle.uri)
            combined += "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"\(subtitle.name)\",LANGUAGE=\"\(subtitle.language)\",URI=\"\(absoluteUri)\"\n"
        }

        if !subtitles.isEmpty {
            combined += "\n"
        }

        // Add audio tracks as separate media groups
        for (index, trackInfo) in audioTrackInfo.enumerated() {
            let language = trackInfo["Language"] as? String ?? "und"
            let displayTitle = trackInfo["DisplayTitle"] as? String ?? "Audio \(index + 1)"
            let codec = trackInfo["Codec"] as? String
            let channels = trackInfo["Channels"] as? Int

            // Format display name with codec and channel info
            var name = displayTitle
            if let codec = codec, let channels = channels {
                let channelStr = formatChannels(channels)
                name = "\(language.uppercased()) (\(codec.uppercased()) \(channelStr))"
            } else if let codec = codec {
                name = "\(language.uppercased()) (\(codec.uppercased()))"
            }

            let isDefault = index == 0

            // Use custom protocol URL for audio renditions
            // This ensures requests go through our resource loader
            let audioUrl = "jellyfin-multi://server/audio/\(index)/main.m3u8"

            combined += "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"\(name)\",LANGUAGE=\"\(language)\""

            if isDefault {
                combined += ",DEFAULT=YES,AUTOSELECT=YES"
            } else {
                combined += ",AUTOSELECT=YES"
            }

            combined += ",URI=\"\(audioUrl)\"\n"
        }

        combined += "\n"

        // Add video stream (from first manifest)
        if let firstManifest = parsedManifests.first {
            combined += "#EXT-X-STREAM-INF:"
            combined += "BANDWIDTH=\(firstManifest.bandwidth ?? 5000000)"

            if let resolution = firstManifest.resolution {
                combined += ",RESOLUTION=\(resolution)"
            }

            combined += ",AUDIO=\"audio\""

            // Reference subtitle group if we have subtitles
            if !subtitles.isEmpty {
                combined += ",SUBTITLES=\"subs\""
            }

            combined += "\n"

            // Use video URI from parsed manifest
            if let videoUri = firstManifest.videoUri {
                combined += "\(makeAbsoluteUrl(baseUrl: baseUrl, relativeUrl: videoUri))\n"
            } else {
                // Fallback to base URL
                combined += "\(baseUrl)\n"
            }
        }

        return combined
    }

    /// Convert relative URL to absolute URL by replacing the last path component
    /// - Parameters:
    ///   - baseUrl: Base URL (e.g., "http://server:8096/Videos/123/master.m3u8?api_key=...")
    ///   - relativeUrl: Relative URL (e.g., "main.m3u8?api_key=...")
    /// - Returns: Absolute URL
    private func makeAbsoluteUrl(baseUrl: String, relativeUrl: String) -> String {
        // If already absolute (starts with http/https), return as-is
        if relativeUrl.lowercased().hasPrefix("http://") || relativeUrl.lowercased().hasPrefix("https://") {
            return relativeUrl
        }

        // Parse the base URL to extract components
        guard let baseURL = URL(string: baseUrl) else {
            // Fallback: simple concatenation
            return baseUrl.hasSuffix("/") ? baseUrl + relativeUrl : baseUrl + "/" + relativeUrl
        }

        // Remove query string and fragment from base URL to get just the path
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseUrl.hasSuffix("/") ? baseUrl + relativeUrl : baseUrl + "/" + relativeUrl
        }

        // Remove the last path component (e.g., "master.m3u8") and append the relative URL
        var pathComponents = components.path.split(separator: "/").map(String.init)
        if !pathComponents.isEmpty {
            pathComponents.removeLast() // Remove "master.m3u8"
        }

        // Append the relative URL's path component
        let relativePath = relativeUrl.split(separator: "?").first.map(String.init) ?? relativeUrl
        pathComponents.append(relativePath)

        // Reconstruct the path
        components.path = "/" + pathComponents.joined(separator: "/")

        // Preserve query parameters from the relative URL if present
        if let queryStart = relativeUrl.firstIndex(of: "?") {
            let relativeQuery = String(relativeUrl[relativeUrl.index(after: queryStart)...])
            components.query = relativeQuery
        }

        return components.url?.absoluteString ?? baseUrl
    }

    /// Format channel count to human-readable string
    /// - Parameter channels: Number of audio channels
    /// - Returns: Formatted string (e.g., "Stereo", "5.1", "7.1")
    private func formatChannels(_ channels: Int) -> String {
        switch channels {
        case 1:
            return "Mono"
        case 2:
            return "Stereo"
        case 6:
            return "5.1"
        case 8:
            return "7.1"
        default:
            return "\(channels)ch"
        }
    }
}

// Safe array access extension
extension Array {
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}
