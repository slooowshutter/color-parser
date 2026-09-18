import { requireNativeModule } from 'expo';
import type { ImagePickerAsset } from 'expo-image-picker';

/** An oriented local image; large originals are reduced before decoding to bound memory. */
export type SamplingPhoto = {
  uri: string;
  width: number;
  height: number;
  resized: boolean;
  colorSpace: 'sRGB';
  originalProfile: string;
};

/** Bakes orientation into a PNG so the displayed image and sampled pixel coordinates agree. */
export async function preparePhoto(asset: ImagePickerAsset): Promise<SamplingPhoto> {
  const normalizer = requireNativeModule<{ preparePhoto: (uri: string) => Promise<SamplingPhoto> }>('ColorImage');
  return normalizer.preparePhoto(asset.uri);
}

/** Deletes only the normalizer's temporary PNG; native validation protects original photo files. */
export async function releasePhoto(uri: string): Promise<void> {
  const normalizer = requireNativeModule<{ releasePhoto: (uri: string) => Promise<void> }>('ColorImage');
  return normalizer.releasePhoto(uri);
}
