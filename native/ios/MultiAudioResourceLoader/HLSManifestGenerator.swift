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
        // NOTE: We create multiple stream variants instead of separate audio renditions
        // because Jellyfin doesn't provide audio-only HLS streams (always muxed video+audio)
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

        // Add each audio track as a separate stream variant (not as audio rendition)
        // This works around Jellyfin's limitation of not providing audio-only streams
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

            // Use the video URI from the parsed manifest for this audio track
            // IMPORTANT: Prepend baseUrl to make relative URLs absolute
            let streamUrl: String
            if let videoUri = parsedManifests[safe: index]?.videoUri {
                streamUrl = makeAbsoluteUrl(baseUrl: baseUrl, relativeUrl: videoUri)
            } else {
                // Fallback: construct URL with audioStreamIndex parameter
                // Remove any existing audioStreamIndex from baseUrl first
                var cleanBase = baseUrl
                if let range = cleanBase.range(of: "&audioStreamIndex=") {
                    if let endRange = cleanBase[range.upperBound...].firstIndex(of: "&") {
                        cleanBase = String(cleanBase[..<range.lowerBound]) + String(cleanBase[endRange...])
                    } else {
                        cleanBase = String(cleanBase[..<range.lowerBound])
                    }
                }
                streamUrl = "\(cleanBase)&audioStreamIndex=\(index)"
            }

            // Add stream variant (remove invalid NAME attribute)
            let baseBandwidth = parsedManifests[safe: index]?.bandwidth ?? 5000000
            let bandwidth = baseBandwidth + (index * 1000)

            combined += "#EXT-X-STREAM-INF:BANDWIDTH=\(bandwidth)"

            if let resolution = parsedManifests[safe: index]?.resolution {
                combined += ",RESOLUTION=\(resolution)"
            }

            // Reference subtitle group if we have subtitles
            if !subtitles.isEmpty {
                combined += ",SUBTITLES=\"subs\""
            }

            combined += "\n\(streamUrl)\n"
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
