# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# react-native-audio-recorder-player
-keep class com.dooboolab.** { *; }

# @react-native-community/voice
-keep class com.wenkesj.voice.** { *; }

# expo-speech
-keep class expo.modules.speech.** { *; }

# expo-clipboard
-keep class expo.modules.clipboard.** { *; }

# expo-av
-keep class expo.modules.av.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Keep Kotlin classes
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
