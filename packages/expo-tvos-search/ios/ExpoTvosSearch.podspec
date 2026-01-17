Pod::Spec.new do |s|
  s.name           = 'ExpoTvosSearch'
  s.version        = '1.0.0'
  s.summary        = 'Native tvOS search view with SwiftUI .searchable modifier'
  s.description    = 'Provides a native tvOS search experience using SwiftUI searchable modifier for proper focus and keyboard navigation'
  s.author         = 'TomoTV'
  s.homepage       = 'https://github.com/tomotv/expo-tvos-search'
  s.license        = { :type => 'MIT' }
  s.source         = { :git => '' }

  s.platforms      = { :ios => '15.1', :tvos => '15.0' }
  s.swift_version  = '5.9'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
end
