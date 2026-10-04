const fs = require('node:fs');
const path = require('node:path');

/**
 * Patches react-native-razorpay's JS entry to be compatible with the New
 * Architecture on Android.
 *
 * Problem: `RazorpayCheckout.js` (v3.0.0) evaluates this at import time:
 *   RazorpayEventEmitterModule = require('./src/NativeRazorpayEventEmitter').default;
 *   const razorpayEvents = new NativeEventEmitter(RazorpayEventEmitterModule);
 * `NativeRazorpayEventEmitter` calls TurboModuleRegistry.getEnforcing('RazorpayEventEmitter'),
 * but Android never registers that module (its native side emits via
 * RCTDeviceEventEmitter; `RazorpayEventEmitter` only exists on iOS). On Expo
 * SDK 54 / RN 0.81 New Architecture the failed lookup + NativeEventEmitter(undefined)
 * crashes the app at startup with:
 *   [runtime not ready] Exception in HostFunction: ... JavaScriptContextHolder.get() ...
 *
 * Fix: resolve native modules lazily (only when a payment is opened) and use
 * DeviceEventEmitter on Android.
 */

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-razorpay',
  'RazorpayCheckout.js'
);

const marker = 'ANDROID_DEVICE_EVENT_EMITTER_PATCH';
const anchor = "const razorpayEvents = new NativeEventEmitter(RazorpayEventEmitterModule);";

const patchedSource = `'use strict';

import { NativeModules, NativeEventEmitter, DeviceEventEmitter, Platform } from 'react-native';

// ${marker}
// Runtime detection for new architecture.
// RN <0.74 uses __turboModuleProxy; RN >=0.74 (bridgeless) exposes TurboModuleRegistry and nativeFabricUIManager instead.
const isTurboModuleEnabled =
  global.__turboModuleProxy != null ||
  global.TurboModuleRegistry != null ||
  global.nativeFabricUIManager != null;

// Resolve native modules lazily so that importing this package never touches
// native code. On Android there is no 'RazorpayEventEmitter' native module, and
// resolving it eagerly at import time crashes the app on the New Architecture.
let _checkoutModule;

const getCheckoutModule = () => {
  if (_checkoutModule !== undefined) return _checkoutModule;

  if (isTurboModuleEnabled) {
    try {
      _checkoutModule = require('./src/NativeRazorpayCheckout').default;
    } catch (error) {
      _checkoutModule = NativeModules.RNRazorpayCheckout;
    }
  } else {
    _checkoutModule = NativeModules.RNRazorpayCheckout;
  }

  return _checkoutModule;
};

let _razorpayEvents;

const getEventEmitter = () => {
  if (_razorpayEvents) return _razorpayEvents;

  if (Platform.OS === 'android') {
    // Android emits payment events through RCTDeviceEventEmitter.
    _razorpayEvents = DeviceEventEmitter;
    return _razorpayEvents;
  }

  let RazorpayEventEmitterModule;

  if (isTurboModuleEnabled) {
    try {
      RazorpayEventEmitterModule = require('./src/NativeRazorpayEventEmitter').default;
    } catch (error) {
      RazorpayEventEmitterModule = NativeModules.RazorpayEventEmitter;
    }
  } else {
    RazorpayEventEmitterModule = NativeModules.RazorpayEventEmitter;
  }

  _razorpayEvents = new NativeEventEmitter(RazorpayEventEmitterModule);
  return _razorpayEvents;
};

const removeSubscriptions = () => {
  const razorpayEvents = getEventEmitter();
  razorpayEvents.removeAllListeners('Razorpay::PAYMENT_SUCCESS');
  razorpayEvents.removeAllListeners('Razorpay::PAYMENT_ERROR');
  razorpayEvents.removeAllListeners('Razorpay::EXTERNAL_WALLET_SELECTED');
};

class RazorpayCheckout {
  static open(options, successCallback, errorCallback) {
    return new Promise(function(resolve, reject) {
      const razorpayEvents = getEventEmitter();
      razorpayEvents.addListener('Razorpay::PAYMENT_SUCCESS', (data) => {
        let resolveFn = successCallback || resolve;
        resolveFn(data);
        removeSubscriptions();
      });
      razorpayEvents.addListener('Razorpay::PAYMENT_ERROR', (data) => {
        let rejectFn = errorCallback || reject;
        rejectFn(data);
        removeSubscriptions();
      });
      getCheckoutModule().open(options);
    });
  }
  static onExternalWalletSelection(externalWalletCallback) {
    const razorpayEvents = getEventEmitter();
    razorpayEvents.addListener('Razorpay::EXTERNAL_WALLET_SELECTED', (data) => {
      externalWalletCallback(data);
      removeSubscriptions();
    });
  }
}

export default RazorpayCheckout;
`;

if (!fs.existsSync(targetPath)) {
  console.warn('[patch-react-native-razorpay] Skipped: package not installed.');
  process.exit(0);
}

const source = fs.readFileSync(targetPath, 'utf8');

if (source.includes(marker)) {
  console.log('[patch-react-native-razorpay] Already applied.');
  process.exit(0);
}

if (!source.includes(anchor)) {
  console.error(
    '[patch-react-native-razorpay] Failed: expected anchor not found (package version changed?).'
  );
  process.exit(1);
}

fs.writeFileSync(targetPath, patchedSource, 'utf8');
console.log('[patch-react-native-razorpay] Applied.');
