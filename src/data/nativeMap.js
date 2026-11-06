import { Capacitor, registerPlugin } from '@capacitor/core';
const HuntMap = registerPlugin('HuntMap');
export const isNativeMap = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
export const openNativeMap = (position, locations, failed = false) => HuntMap.open({ latitude: position.latitude, longitude: position.longitude, locations, failed });
export const updateNativeMap = (locations, failed = false) => HuntMap.update({ locations, failed });
export const closeNativeMap = () => HuntMap.close();
