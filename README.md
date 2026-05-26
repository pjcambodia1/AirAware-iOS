# AirAware v82r3 APK Package

This v82r3 package adds stronger Android permission handling:

- Capacitor Geolocation plugin
- Capacitor Camera plugin pre-permission request
- AndroidManifest GPS/camera/internet permissions
- WebView camera permission bridge in MainActivity.java
- OpenAI endpoint remains: https://airtrueiq.com/api/openai

Upload these files to the AirAware APK repo and run GitHub Actions.


## v82r3 change

Adds Android/WebView top safe spacing so the title no longer sits under the phone status bar.


## v82r4
- AndroidManifest.xml is included directly with INTERNET, LOCATION, and CAMERA permissions.
- App label corrected to AirAware.
- Top spacing reduced from v82r3 so the header is not pushed too far down.
- Workflow includes a manifest permission verification step before APK build.
## v82r15
-This v82r15 package adds stronger Android permission handling:

