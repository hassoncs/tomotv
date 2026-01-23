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

        // Build combined manifest
        var combined = "#EXTM3U\n"
        combined += "#EXT-X-VERSION:3\n\n"

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

            // Use the audio URI from the parsed manifest if available
            // Otherwise construct from base URL
            let audioUrl: String
            if let audioUri = parsedManifests[safe: index]?.audioUri {
                audioUrl = audioUri
            } else if let videoUri = parsedManifests[safe: index]?.videoUri {
                audioUrl = videoUri
            } else {
                audioUrl = "\(baseUrl)?audioStreamIndex=\(index)"
            }

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

            combined += ",AUDIO=\"audio\"\n"

            // Use video URI from parsed manifest
            if let videoUri = firstManifest.videoUri {
                combined += "\(videoUri)\n"
            } else {
                // Fallback to base URL
                combined += "\(baseUrl)\n"
            }
        }

        return combined
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
