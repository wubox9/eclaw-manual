import { useApp } from '../context/AppContext'

export default function Toast() {
  const { toastMessage, toastVisible } = useApp()
  return (
    <div id="toast" className={toastVisible ? 'visible' : ''}>
      {toastMessage}
    </div>
  )
}
