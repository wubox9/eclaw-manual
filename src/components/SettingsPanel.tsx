import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { LocationTracker } from '../lib/location'
import type { AppSettings } from '../lib/types'

export default function SettingsPanel() {
  const { settings, settingsOpen, toggleSettings, saveSettings, showToast } = useApp()

  const [host, setHost] = useState(settings.host)
  const [port, setPort] = useState(String(settings.port))
  const [secure, setSecure] = useState(settings.secure)
  const [theme, setTheme] = useState(settings.theme)
  const [voiceLang, setVoiceLang] = useState(settings.voiceLang)
  const [locationTracking, setLocationTracking] = useState(settings.locationTracking)
  const [locationInterval, setLocationInterval] = useState(String(settings.locationInterval))
  const [p2pEnabled, setP2PEnabled] = useState(settings.p2pEnabled)
  const [p2pDisplayName, setP2PDisplayName] = useState(settings.p2pDisplayName)

  // Populate form when settings panel opens
  useEffect(() => {
    if (settingsOpen) {
      setHost(settings.host)
      setPort(String(settings.port))
      setSecure(settings.secure)
      setTheme(settings.theme)
      setVoiceLang(settings.voiceLang)
      setLocationTracking(settings.locationTracking)
      setLocationInterval(String(settings.locationInterval))
      setP2PEnabled(settings.p2pEnabled)
      setP2PDisplayName(settings.p2pDisplayName)
    }
  }, [settingsOpen, settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const h = host.trim()
    const p = parseInt(port, 10)
    if (!h) { showToast('Host is required'); return }
    if (isNaN(p) || p < 1 || p > 65535) { showToast('Invalid port number'); return }

    const newSettings: AppSettings = {
      ...settings,
      host: h, port: p, secure, theme: theme as AppSettings['theme'],
      voiceLang, locationTracking,
      locationInterval: parseInt(locationInterval, 10) || 60,
      p2pEnabled, p2pDisplayName: p2pDisplayName.trim()
    }
    saveSettings(newSettings)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) toggleSettings()
  }

  return (
    <div className={`settings-panel${settingsOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Settings" onClick={handleBackdropClick}>
      <div className="settings-sheet">
        <div className="settings-header"><h2>Settings</h2></div>
        <form onSubmit={handleSubmit}>
          <div className="settings-group">
            <label htmlFor="setting-host">Gateway Host</label>
            <input type="text" id="setting-host" value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" required />
          </div>
          <div className="settings-group">
            <label htmlFor="setting-port">Gateway Port</label>
            <input type="number" id="setting-port" value={port} onChange={e => setPort(e.target.value)} min={1} max={65535} placeholder="18789" required />
          </div>
          <div className="settings-group settings-group-inline">
            <label htmlFor="setting-secure">Use Secure Connection (wss://)</label>
            <input type="checkbox" id="setting-secure" checked={secure} onChange={e => setSecure(e.target.checked)} />
          </div>
          <div className="settings-group">
            <label htmlFor="setting-theme">Theme</label>
            <select id="setting-theme" value={theme} onChange={e => setTheme(e.target.value as AppSettings['theme'])}>
              <option value="dark">Dark</option>
              <option value="amoled">AMOLED Black</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="settings-divider" />
          <div className="settings-group settings-group-inline">
            <label htmlFor="setting-p2p-enabled">P2P Messaging</label>
            <input type="checkbox" id="setting-p2p-enabled" checked={p2pEnabled} onChange={e => setP2PEnabled(e.target.checked)} />
          </div>
          {p2pEnabled && (
            <div className="settings-group">
              <label htmlFor="setting-p2p-display-name">Display Name</label>
              <input type="text" id="setting-p2p-display-name" value={p2pDisplayName} onChange={e => setP2PDisplayName(e.target.value)} placeholder="Anonymous" maxLength={32} />
            </div>
          )}
          <div className="settings-divider" />
          <div className="settings-group">
            <label htmlFor="setting-voice-lang">Voice Language</label>
            <select id="setting-voice-lang" value={voiceLang} onChange={e => setVoiceLang(e.target.value)}>
              <option value="">Auto-detect</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="zh-CN">Chinese (Simplified)</option>
              <option value="zh-TW">Chinese (Traditional)</option>
              <option value="ja-JP">Japanese</option>
              <option value="ko-KR">Korean</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
          </div>
          <div className="settings-group settings-group-inline">
            <label htmlFor="setting-location-tracking">Location Tracking</label>
            <input type="checkbox" id="setting-location-tracking" checked={locationTracking} onChange={e => setLocationTracking(e.target.checked)} />
          </div>
          {locationTracking && (
            <>
              <div className="settings-group">
                <label htmlFor="setting-location-interval">Recording Interval</label>
                <select id="setting-location-interval" value={locationInterval} onChange={e => setLocationInterval(e.target.value)}>
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                  <option value="1440">24 hours</option>
                </select>
              </div>
              <div className="settings-group">
                <button type="button" className="btn-secondary" onClick={() => LocationTracker.download()}>Download Location Log</button>
              </div>
            </>
          )}
          <div className="settings-actions">
            <button type="button" className="btn-cancel" onClick={toggleSettings}>Cancel</button>
            <button type="submit" className="btn-save">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
