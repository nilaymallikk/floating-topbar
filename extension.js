import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gvc from 'gi://Gvc';
import NM from 'gi://NM';
import St from 'gi://St';
import UPowerGlib from 'gi://UPowerGlib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

import {buildPanelStylesheet} from './styleBuilder.js';

export default class FloatingTopBarExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._settingsSignal = 0;
        this._themeContext = null;
        this._themeChangedSignal = 0;
        this._loadedTheme = null;
        this._customStyleFile = null;
        this._lastStyleCss = null;

        this._volLabel = null;
        this._wifiLabel = null;
        this._btLabel = null;

        this._volOutput = null;
        this._volStream = null;
        this._volStreamSignals = [];
        this._volControl = null;
        this._volControlSignals = [];
        this._volIconSignal = 0;

        this._netIndicator = null;
        this._nmCancellable = null;
        this._nmClient = null;
        this._nmSignals = [];
        this._wifiDevice = null;
        this._wifiDeviceSignal = 0;
        this._wifiAp = null;
        this._wifiApSignal = 0;
        this._netIconSignals = [];

        this._btIndicator = null;
        this._btIconSignal = 0;
        this._btClientSignal = 0;
        this._upClient = null;
        this._upClientSignals = [];
        this._upDevSignals = [];

        this._retrySourceId = 0;

        this._settingsSignal = this._settings.connect('changed', () => this._onSettingsChanged());
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._themeChangedSignal = this._themeContext.connect('changed', () => {
            const theme = this._themeContext?.get_theme();
            if (theme && theme !== this._loadedTheme)
                this._applyPanelStyle(true);
        });

        Main.panel?.add_style_class_name('floating-topbar-styled');
        this._applyPanelStyle(true);
        this._attachQuickSettingsLabels();
    }

    disable() {
        if (this._retrySourceId) {
            GLib.Source.remove(this._retrySourceId);
            this._retrySourceId = 0;
        }

        if (this._settings && this._settingsSignal) {
            this._settings.disconnect(this._settingsSignal);
            this._settingsSignal = 0;
        }
        if (this._themeContext && this._themeChangedSignal) {
            this._themeContext.disconnect(this._themeChangedSignal);
            this._themeChangedSignal = 0;
        }
        this._settings = null;

        Main.panel?.remove_style_class_name('floating-topbar-styled');
        this._unloadPanelStylesheet();
        this._themeContext = null;

        this._detachVolume();
        this._detachWifi();
        this._detachBluetooth();
    }

    _onSettingsChanged() {
        this._applyPanelStyle(false);
        this._syncVolume();
        this._syncWifi();
        this._syncBluetooth();
    }

    _getCustomStyleFile() {
        if (!this._customStyleFile) {
            const runtimeDir = GLib.get_user_runtime_dir() || GLib.get_tmp_dir();
            GLib.mkdir_with_parents(runtimeDir, 0o700);
            const path = GLib.build_filenamev([runtimeDir, 'floating-topbar-custom.css']);
            this._customStyleFile = Gio.File.new_for_path(path);
        }
        return this._customStyleFile;
    }

    _applyPanelStyle(force = false) {
        if (!this._settings || !this._themeContext)
            return;

        const theme = this._themeContext.get_theme();
        if (!theme)
            return;

        const css = buildPanelStylesheet({
            backgroundColor: this._settings.get_string('background-color'),
            backgroundOpacity: this._settings.get_int('background-opacity'),
            overviewOpacity: this._settings.get_int('overview-opacity'),
            borderColor: this._settings.get_string('border-color'),
            borderThickness: this._settings.get_int('border-thickness'),
            textColor: this._settings.get_string('text-color'),
            borderRadius: this._settings.get_int('border-radius'),
            panelHeight: this._settings.get_int('panel-height'),
            marginVertical: this._settings.get_int('margin-vertical'),
            marginHorizontal: this._settings.get_int('margin-horizontal'),
        });

        if (!force && css === this._lastStyleCss && theme === this._loadedTheme)
            return;

        const file = this._getCustomStyleFile();
        if (this._loadedTheme) {
            try {
                this._loadedTheme.unload_stylesheet(file);
            } catch {
                // Previous theme may already be disposed or not have this sheet loaded
            }
        }

        // Write dynamic stylesheet to tmpfs runtime dir so other extensions
        // clearing Main.panel.style (e.g. dash2dock-lite on window close) cannot wipe it.
        file.replace_contents(
            css,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
        );

        this._loadedTheme = theme;
        this._lastStyleCss = css;
        theme.load_stylesheet(file);
    }

    _unloadPanelStylesheet() {
        const file = this._customStyleFile;
        const theme = this._loadedTheme ?? this._themeContext?.get_theme();
        if (theme && file) {
            try {
                theme.unload_stylesheet(file);
            } catch {
                // Ignore if already unloaded
            }
        }
        if (file) {
            try {
                file.delete(null);
            } catch {
                // Ignore if already deleted
            }
        }
        this._loadedTheme = null;
        this._lastStyleCss = null;
        this._customStyleFile = null;
    }

    _attachQuickSettingsLabels() {
        const qs = Main.panel.statusArea.quickSettings;
        // QuickSettings populates indicators asynchronously during shell startup
        if (!qs || !qs._volumeOutput || !qs._network) {
            this._retrySourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                this._retrySourceId = 0;
                this._attachQuickSettingsLabels();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._attachVolume(qs._volumeOutput);
        this._attachWifi(qs._network);
        if (qs._bluetooth)
            this._attachBluetooth(qs._bluetooth);
    }

    // ── Volume % ──────────────────────────────────────────────────────────────
    _attachVolume(volOutput) {
        this._volOutput = volOutput;
        this._volControl = Volume.getMixerControl();

        this._volLabel = new St.Label({
            style_class: 'floating-topbar-pct',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        if (volOutput._indicator) {
            volOutput.insert_child_above(this._volLabel, volOutput._indicator);
            this._volIconSignal = volOutput._indicator.connect('notify::visible', () =>
                this._syncVolume());
        } else {
            volOutput.add_child(this._volLabel);
        }

        this._volControlSignals = [
            this._volControl.connect('state-changed', () => this._bindVolStream()),
            this._volControl.connect('default-sink-changed', () => this._bindVolStream()),
        ];
        this._bindVolStream();
    }

    _bindVolStream() {
        if (this._volStream) {
            for (const id of this._volStreamSignals)
                GObject.signal_handler_disconnect(this._volStream, id);
            this._volStreamSignals = [];
            this._volStream = null;
        }

        if (this._volControl?.get_state() === Gvc.MixerControlState.READY) {
            this._volStream = this._volControl.get_default_sink();
            if (this._volStream) {
                this._volStreamSignals = [
                    this._volStream.connect('notify::volume', () => this._syncVolume()),
                    this._volStream.connect('notify::is-muted', () => this._syncVolume()),
                ];
            }
        }
        this._syncVolume();
    }

    _syncVolume() {
        if (!this._volLabel || !this._volOutput)
            return;
        if (this._settings && !this._settings.get_boolean('show-volume-percentage')) {
            this._volLabel.visible = false;
            return;
        }
        const iconVisible = this._volOutput._indicator ? this._volOutput._indicator.visible : true;
        if (!iconVisible || !this._volStream) {
            this._volLabel.visible = false;
            return;
        }
        const maxNorm = this._volControl.get_vol_max_norm() || 65536;
        const pct = this._volStream.is_muted
            ? 0
            : Math.round((this._volStream.volume / maxNorm) * 100);
        this._volLabel.text = `${pct}%`;
        this._volLabel.visible = true;
    }

    _detachVolume() {
        if (this._volStream) {
            for (const id of this._volStreamSignals)
                GObject.signal_handler_disconnect(this._volStream, id);
            this._volStreamSignals = [];
            this._volStream = null;
        }
        if (this._volControl) {
            for (const id of this._volControlSignals)
                GObject.signal_handler_disconnect(this._volControl, id);
            this._volControlSignals = [];
            this._volControl = null;
        }
        if (this._volIconSignal && this._volOutput?._indicator) {
            GObject.signal_handler_disconnect(this._volOutput._indicator, this._volIconSignal);
            this._volIconSignal = 0;
        }
        if (this._volLabel) {
            this._volLabel.destroy();
            this._volLabel = null;
        }
        this._volOutput = null;
    }

    // ── Wi-Fi Signal % ────────────────────────────────────────────────────────
    _attachWifi(netIndicator) {
        this._netIndicator = netIndicator;
        this._wifiLabel = new St.Label({
            style_class: 'floating-topbar-pct',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        if (netIndicator._primaryIndicator) {
            netIndicator.insert_child_above(this._wifiLabel, netIndicator._primaryIndicator);
            this._netIconSignals = [
                netIndicator._primaryIndicator.connect('notify::visible', () => this._syncWifi()),
                netIndicator._primaryIndicator.connect('notify::icon-name', () => this._syncWifi()),
            ];
        } else {
            netIndicator.add_child(this._wifiLabel);
        }

        this._nmCancellable = new Gio.Cancellable();
        this._initNmClient().catch(() => {});
    }

    async _initNmClient() {
        const client = this._netIndicator?._client
            ?? await NM.Client.new_async(this._nmCancellable);
        if (!client || !this._wifiLabel)
            return;
        this._nmClient = client;
        this._nmSignals = [
            this._nmClient.connect('device-added', () => this._bindWifiDevice()),
            this._nmClient.connect('device-removed', () => this._bindWifiDevice()),
            this._nmClient.connect('notify::primary-connection', () => this._bindWifiDevice()),
        ];
        this._bindWifiDevice();
    }

    _bindWifiDevice() {
        if (this._wifiAp && this._wifiApSignal) {
            GObject.signal_handler_disconnect(this._wifiAp, this._wifiApSignal);
            this._wifiApSignal = 0;
            this._wifiAp = null;
        }
        if (this._wifiDevice && this._wifiDeviceSignal) {
            // NM.Device.disconnect() shadows GObject.disconnect()
            GObject.signal_handler_disconnect(this._wifiDevice, this._wifiDeviceSignal);
            this._wifiDeviceSignal = 0;
            this._wifiDevice = null;
        }

        const devices = this._nmClient?.get_devices() ?? [];
        const wifiDevs = devices.filter(d => d.get_device_type() === NM.DeviceType.WIFI);
        this._wifiDevice = wifiDevs.find(d => d.get_active_access_point()) ?? wifiDevs[0] ?? null;

        if (this._wifiDevice) {
            this._wifiDeviceSignal = this._wifiDevice.connect('notify::active-access-point', () =>
                this._bindWifiAp());
            this._bindWifiAp();
        } else {
            this._syncWifi();
        }
    }

    _bindWifiAp() {
        if (this._wifiAp && this._wifiApSignal) {
            GObject.signal_handler_disconnect(this._wifiAp, this._wifiApSignal);
            this._wifiApSignal = 0;
            this._wifiAp = null;
        }
        this._wifiAp = this._wifiDevice?.get_active_access_point() ?? null;
        if (this._wifiAp) {
            this._wifiApSignal = this._wifiAp.connect('notify::strength', () => this._syncWifi());
        }
        this._syncWifi();
    }

    _syncWifi() {
        if (!this._wifiLabel || !this._netIndicator)
            return;
        if (this._settings && !this._settings.get_boolean('show-wifi-percentage')) {
            this._wifiLabel.visible = false;
            return;
        }
        const icon = this._netIndicator._primaryIndicator;
        const isWifiIcon = icon?.visible && (icon.icon_name ?? '').includes('wireless');
        if (!isWifiIcon || !this._wifiDevice) {
            this._wifiLabel.visible = false;
            return;
        }
        const strength = this._wifiAp ? this._wifiAp.get_strength() : 0;
        this._wifiLabel.text = `${String(strength).padStart(2, '0')}%`;
        this._wifiLabel.visible = true;
    }

    _detachWifi() {
        if (this._nmCancellable) {
            this._nmCancellable.cancel();
            this._nmCancellable = null;
        }
        if (this._wifiAp && this._wifiApSignal) {
            GObject.signal_handler_disconnect(this._wifiAp, this._wifiApSignal);
            this._wifiApSignal = 0;
            this._wifiAp = null;
        }
        if (this._wifiDevice && this._wifiDeviceSignal) {
            GObject.signal_handler_disconnect(this._wifiDevice, this._wifiDeviceSignal);
            this._wifiDeviceSignal = 0;
            this._wifiDevice = null;
        }
        if (this._nmClient) {
            for (const id of this._nmSignals)
                GObject.signal_handler_disconnect(this._nmClient, id);
            this._nmSignals = [];
            this._nmClient = null;
        }
        if (this._netIconSignals.length && this._netIndicator?._primaryIndicator) {
            for (const id of this._netIconSignals)
                GObject.signal_handler_disconnect(this._netIndicator._primaryIndicator, id);
            this._netIconSignals = [];
        }
        if (this._wifiLabel) {
            this._wifiLabel.destroy();
            this._wifiLabel = null;
        }
        this._netIndicator = null;
    }

    // ── Bluetooth Device Battery % ────────────────────────────────────────────
    _attachBluetooth(btIndicator) {
        this._btIndicator = btIndicator;
        this._btLabel = new St.Label({
            style_class: 'floating-topbar-pct',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });

        if (btIndicator._indicator) {
            btIndicator.insert_child_above(this._btLabel, btIndicator._indicator);
            this._btIconSignal = btIndicator._indicator.connect('notify::visible', () =>
                this._syncBluetooth());
        } else {
            btIndicator.add_child(this._btLabel);
        }

        if (btIndicator._client) {
            this._btClientSignal = btIndicator._client.connect('devices-changed', () =>
                this._syncBluetooth());
        }

        try {
            this._upClient = UPowerGlib.Client.new();
            this._upClientSignals = [
                this._upClient.connect('device-added', () => this._rebindUpDevices()),
                this._upClient.connect('device-removed', () => this._rebindUpDevices()),
            ];
            this._rebindUpDevices();
        } catch {
            this._syncBluetooth();
        }
    }

    _isPeripheralBattery(dev) {
        return dev &&
            dev.kind !== UPowerGlib.DeviceKind.BATTERY &&
            dev.kind !== UPowerGlib.DeviceKind.LINE_POWER &&
            dev.kind !== UPowerGlib.DeviceKind.UNKNOWN;
    }

    _rebindUpDevices() {
        for (const [dev, id] of this._upDevSignals) {
            try {
                GObject.signal_handler_disconnect(dev, id);
            } catch {
                // Device may already be disposed
            }
        }
        this._upDevSignals = [];

        if (this._upClient) {
            for (const dev of this._upClient.get_devices()) {
                if (this._isPeripheralBattery(dev)) {
                    const id = dev.connect('notify::percentage', () => this._syncBluetooth());
                    this._upDevSignals.push([dev, id]);
                }
            }
        }
        this._syncBluetooth();
    }

    _syncBluetooth() {
        if (!this._btLabel || !this._btIndicator)
            return;
        if (this._settings && !this._settings.get_boolean('show-bluetooth-percentage')) {
            this._btLabel.visible = false;
            return;
        }
        const iconVisible = this._btIndicator._indicator ? this._btIndicator._indicator.visible : false;
        if (!iconVisible) {
            this._btLabel.visible = false;
            return;
        }

        let pct = null;
        if (this._btIndicator._client) {
            for (const dev of this._btIndicator._client.getDevices()) {
                if (dev.connected && dev.battery_percentage > 0) {
                    pct = Math.round(dev.battery_percentage);
                    break;
                }
            }
        }
        if (pct === null && this._upClient) {
            for (const dev of this._upClient.get_devices()) {
                if (this._isPeripheralBattery(dev) && dev.percentage > 0) {
                    pct = Math.round(dev.percentage);
                    break;
                }
            }
        }

        if (pct === null) {
            this._btLabel.visible = false;
            return;
        }
        this._btLabel.text = `${pct}%`;
        this._btLabel.visible = true;
    }

    _detachBluetooth() {
        for (const [dev, id] of this._upDevSignals) {
            try {
                GObject.signal_handler_disconnect(dev, id);
            } catch {
                // Ignore disposed device
            }
        }
        this._upDevSignals = [];

        if (this._upClient) {
            for (const id of this._upClientSignals)
                GObject.signal_handler_disconnect(this._upClient, id);
            this._upClientSignals = [];
            this._upClient = null;
        }
        if (this._btClientSignal && this._btIndicator?._client) {
            GObject.signal_handler_disconnect(this._btIndicator._client, this._btClientSignal);
            this._btClientSignal = 0;
        }
        if (this._btIconSignal && this._btIndicator?._indicator) {
            GObject.signal_handler_disconnect(this._btIndicator._indicator, this._btIconSignal);
            this._btIconSignal = 0;
        }
        if (this._btLabel) {
            this._btLabel.destroy();
            this._btLabel = null;
        }
        this._btIndicator = null;
    }
}
