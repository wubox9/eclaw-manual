import { useApp } from '../context/AppContext'

export default function OfflineBanner() {
  const { isOffline } = useApp()

  return (
    <div className={`offline-banner${isOffline ? ' visible' : ''}`}>
      No internet connection
    </div>
  )
}
