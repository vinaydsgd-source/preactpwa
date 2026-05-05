import { useCallback, useEffect, useState } from 'preact/hooks';

const detectIos = () => {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent || '';
	const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
	const isIpadOs =
		ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document;
	return isIosDevice || isIpadOs;
};

const detectStandalone = () => {
	if (typeof window === 'undefined') return false;
	const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
	const iosStandalone = window.navigator && window.navigator.standalone === true;
	return Boolean(mq || iosStandalone);
};

export default function useInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState(null);
	const [isInstalled, setIsInstalled] = useState(false);
	const [isIos, setIsIos] = useState(false);

	useEffect(() => {
		setIsIos(detectIos());
		setIsInstalled(detectStandalone());

		const onBeforeInstallPrompt = (event) => {
			event.preventDefault();
			setDeferredPrompt(event);
		};

		const onAppInstalled = () => {
			setDeferredPrompt(null);
			setIsInstalled(true);
		};

		const standaloneMql =
			window.matchMedia && window.matchMedia('(display-mode: standalone)');
		const onDisplayModeChange = (e) => setIsInstalled(e.matches);

		window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
		window.addEventListener('appinstalled', onAppInstalled);
		if (standaloneMql && standaloneMql.addEventListener) {
			standaloneMql.addEventListener('change', onDisplayModeChange);
		}

		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
			window.removeEventListener('appinstalled', onAppInstalled);
			if (standaloneMql && standaloneMql.removeEventListener) {
				standaloneMql.removeEventListener('change', onDisplayModeChange);
			}
		};
	}, []);

	const promptInstall = useCallback(async () => {
		if (!deferredPrompt) return { outcome: 'unavailable' };
		try {
			deferredPrompt.prompt();
			const choice = await deferredPrompt.userChoice;
			setDeferredPrompt(null);
			return choice;
		} catch (err) {
			return { outcome: 'error', error: err };
		}
	}, [deferredPrompt]);

	return {
		canInstall: Boolean(deferredPrompt),
		isIos,
		isInstalled,
		promptInstall,
	};
}
