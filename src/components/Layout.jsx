import { Calendar, Home, Settings } from 'lucide-react'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Inspection Optimizer
            </h2>
          </div>
          
          <nav className="px-4 space-y-1">
            <a
              href="#"
              className="flex items-center px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Home className="w-5 h-5 mr-3" />
              Dashboard
            </a>
            
            <a
              href="#"
              className="flex items-center px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Calendar className="w-5 h-5 mr-3" />
              Calendar View
            </a>
            
            <a
              href="#"
              className="flex items-center px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </a>
          </nav>
          
          <div className="absolute bottom-4 left-4 text-xs text-gray-500">
            MVP v1.0.0
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}