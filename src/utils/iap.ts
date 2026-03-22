// src/utils/iap.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type PurchaseError,
  type Product,
  type Purchase,
} from 'react-native-iap';

const PRO_PRODUCT_ID = Platform.select({
  ios: 'com.shellplayer.pro',
  android: 'shellplayer_pro',
}) as string;

const PRO_KEY = '@pro_purchased';

let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener> | null = null;
let purchaseErrorSub: ReturnType<typeof purchaseErrorListener> | null = null;

export async function initIAP(): Promise<void> {
  try {
    await initConnection();
  } catch {}
}

export async function teardownIAP(): Promise<void> {
  purchaseUpdateSub?.remove();
  purchaseErrorSub?.remove();
  purchaseUpdateSub = null;
  purchaseErrorSub = null;
  try {
    await endConnection();
  } catch {}
}

export async function getProProduct(): Promise<Product | null> {
  try {
    const products = await getProducts({ skus: [PRO_PRODUCT_ID] });
    if (products && products.length > 0) {
      return products[0] as Product;
    }
    return null;
  } catch {
    return null;
  }
}

export async function purchasePro(): Promise<boolean> {
  try {
    await requestPurchase(
      Platform.OS === 'ios'
        ? { sku: PRO_PRODUCT_ID }
        : { skus: [PRO_PRODUCT_ID] },
    );
    return true;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const purchases = await getAvailablePurchases();
    const hasPro = purchases.some(p => p.productId === PRO_PRODUCT_ID);
    if (hasPro) {
      await AsyncStorage.setItem(PRO_KEY, 'true');
    }
    return hasPro;
  } catch {
    return false;
  }
}

export async function checkProStatus(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PRO_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export function listenForPurchases(onPurchased: () => void): void {
  purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
    if (purchase.productId === PRO_PRODUCT_ID) {
      await finishTransaction({ purchase, isConsumable: false });
      await AsyncStorage.setItem(PRO_KEY, 'true');
      onPurchased();
    }
  });

  purchaseErrorSub = purchaseErrorListener((_error: PurchaseError) => {
    // silently handle
  });
}

export { PRO_PRODUCT_ID };
