# tvOS Multilayer Icon Setup

There is a backup copy of Image.xcassets in the `./Images.xcassets` folder. This contains the multilayer icon setup for tvOS. If `npm run prebuild` is ran, copy the contents of this folder back into the `./ios/tomotv/Images.xcassets` folder to restore the multilayer icon setup.

export EXPO_TV=1
npm run prebuild

In Xcode:

1. App Icon -> `Brand Assets`
