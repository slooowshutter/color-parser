Pod::Spec.new do |s|
  s.name = 'ColorImage'
  s.version = '1.0.0'
  s.summary = 'Local, color-managed photo decoding for Color Lab'
  s.description = 'Normalizes orientation and embedded image profiles into sRGB PNG pixels.'
  s.license = { :type => 'MIT' }
  s.author = 'Color Lab'
  s.homepage = 'https://expo.dev'
  s.platforms = { :ios => '16.4' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
