import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function StatusBar({ health }) {
  if (!health) {
    return (
      <div className="bg-gray-100 border-b border-gray-200 px-6 py-3">
        <div className="flex items-center text-gray-500">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">Loading system status...</span>
        </div>
      </div>
    )
  }

  const pipedriveStatus = health.pipedrive?.connected ? 'connected' : 'error'
  const googleMapsStatus = health.googleMaps?.configured ? 'connected' : 'warning'

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center space-x-6 text-sm">
        {/* Pipedrive Status */}
        <div className="flex items-center">
          {pipedriveStatus === 'connected' ? (
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500 mr-2" />
          )}
          <span className={pipedriveStatus === 'connected' ? 'text-green-700' : 'text-red-700'}>
            Pipedrive: {pipedriveStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Google Maps Status */}
        <div className="flex items-center">
          {googleMapsStatus === 'connected' ? (
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500 mr-2" />
          )}
          <span className={googleMapsStatus === 'connected' ? 'text-green-700' : 'text-yellow-700'}>
            Maps: {googleMapsStatus === 'connected' ? 'Google Maps' : 'Haversine estimates'}
          </span>
        </div>

        {/* Last Updated */}
        <div className="text-gray-500 ml-auto">
          Last updated: {new Date(health.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Warnings */}
      {!health.googleMaps?.configured && (
        <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 inline-block">
          ⚠️ Drive times are estimates only. Configure Google Maps API key for accurate routing.
        </div>
      )}
      
      {!health.pipedrive?.connected && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1 inline-block">
          ❌ Cannot connect to Pipedrive. Check your API token and domain configuration.
        </div>
      )}
    </div>
  )
}