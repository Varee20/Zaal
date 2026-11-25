// ==========================================================
// patch-android.js - adds Zaal Mini's own native Android code to the Android project that Capacitor generated.
//
// Run by the Android workflow right after "npx cap add android":
//   1. copies native/java/*.java   -> the app's Java folder (the native bridge, Do Not Disturb, the home screen widgets)
//   2. writes MainActivity.java    -> registers the native bridge
//   3. copies native/res/*         -> layouts, widget settings, icons
//   4. patches AndroidManifest.xml -> permissions, the three widgets, the Do Not Disturb receiver
//   5. sets the app version from package.json
// ==========================================================

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = path.join(root, 'android', 'app', 'src', 'main');
const pkg = require(path.join(root, 'package.json'));

if (!fs.existsSync(main)) {
  console.error('android/ was not found. Run "npx cap add android" first.');
  process.exit(1);
}

// 1 + 2. Java
const javaDir = path.join(main, 'java', 'com', 'varee20', 'zaalmini');
fs.mkdirSync(javaDir, { recursive: true });
fs.cpSync(path.join(root, 'native', 'java'), javaDir, { recursive: true });
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), [
  'package com.varee20.zaalmini;',
  '',
  'import android.os.Bundle;',
  'import com.getcapacitor.BridgeActivity;',
  '',
  'public class MainActivity extends BridgeActivity {',
  '    @Override',
  '    public void onCreate(Bundle savedInstanceState) {',
  '        registerPlugin(ZaalNativePlugin.class);',
  '        super.onCreate(savedInstanceState);',
  '    }',
  '}',
  ''
].join('\n'));

// 3. Resources
fs.cpSync(path.join(root, 'native', 'res'), path.join(main, 'res'), { recursive: true });

// 4. Manifest
const manifestPath = path.join(main, 'AndroidManifest.xml');
let xml = fs.readFileSync(manifestPath, 'utf8');

const permissions = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.VIBRATE',
  'android.permission.ACCESS_NOTIFICATION_POLICY',
  'android.permission.QUERY_ALL_PACKAGES',
  'android.permission.PACKAGE_USAGE_STATS'
].filter(p => !xml.includes(p));

if (permissions.length) {
  const lines = permissions.map(p => '    <uses-permission android:name="' + p + '" />').join('\n');
  xml = xml.replace('</manifest>', lines + '\n</manifest>');
}

if (!xml.includes('ZaalWidgetSmall')) {
  const widget = (cls, info) => [
    '        <receiver android:name=".' + cls + '" android:exported="false">',
    '            <intent-filter>',
    '                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />',
    '            </intent-filter>',
    '            <meta-data android:name="android.appwidget.provider" android:resource="@xml/' + info + '" />',
    '        </receiver>'
  ].join('\n');
  const parts = [
    '        <receiver android:name=".DndReceiver" android:exported="false" />',
    widget('ZaalWidgetSmall', 'zw_small_info'),
    widget('ZaalWidgetMedium', 'zw_medium_info'),
    widget('ZaalWidgetLarge', 'zw_large_info')
  ].join('\n');
  xml = xml.replace('</application>', parts + '\n    </application>');
}
fs.writeFileSync(manifestPath, xml);

// 5. Version
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionName\s+"[^"]*"/, 'versionName "' + pkg.version + '"');
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + (parseInt(process.env.VERSION_CODE || '1', 10) || 1));
fs.writeFileSync(gradlePath, gradle);

console.log('Zaal Mini native code added to the Android project.');
