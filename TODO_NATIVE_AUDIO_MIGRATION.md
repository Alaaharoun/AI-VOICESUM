# Native Audio Migration To-Do List

This checklist will help you migrate your Expo app to support real-time live translation on mobile using a native audio recording solution.

---

## 1. Eject from Expo Managed Workflow
- [ ] Run `npx expo eject` to convert to Bare Workflow
- [ ] Commit all changes before ejecting
- [ ] Verify iOS and Android native folders are created

## 2. Install Native Audio Recorder
- [ ] Install `react-native-audio-recorder-player` (`npm install react-native-audio-recorder-player`)
- [ ] For iOS, run `cd ios && pod install`
- [ ] Verify installation and linking (auto-linking for RN 0.60+)

## 3. Update Permissions
- [ ] **Android:** Add microphone and storage permissions to `AndroidManifest.xml`
- [ ] **iOS:** Add microphone usage description to `Info.plist`

## 4. Implement Native Recording
- [ ] Replace Expo AV recording with `react-native-audio-recorder-player`
- [ ] Configure to record in WAV or M4A (mono, 16kHz or 44.1kHz, compatible bitrate)
- [ ] Save or stream audio chunks for real-time use

## 5. Update Live Translation Page
- [ ] Update page to use new native recorder
- [ ] Stream or chunk audio to AssemblyAI in real-time
- [ ] Display live transcription and translation
- [ ] Handle errors and show user-friendly messages

## 6. Testing
- [ ] Test on Android device (record, transcribe, translate)
- [ ] Test on iOS device (record, transcribe, translate)
- [ ] Confirm AssemblyAI accepts audio and returns results
- [ ] Validate UI/UX and error handling

## 7. Finalize & Polish
- [ ] Clean up unused Expo AV code
- [ ] Update documentation and README
- [ ] Prepare for App Store/Play Store submission (privacy, permissions)

---

**Notes:**
- After ejecting, Expo Go will no longer work. Use a custom dev build or Xcode/Android Studio.
- Real-time streaming may require WebSockets or chunked HTTP uploads to AssemblyAI.
- Test on real devices for accurate results.

---

**Check off each item as you complete it!** 