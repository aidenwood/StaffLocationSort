import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  Home,
  DollarSign,
  FileText,
  Check,
  X 
} from 'lucide-react';
import { inspectors, activityTypes } from '../data/mockActivities';

const BookingSetter = ({ selectedSlot, onBookingConfirm, onCancel, onLocationUpdate }) => {
  const [bookingDetails, setBookingDetails] = useState({
    subject: '',
    type: 'building_inspection',
    duration: '02:00:00',
    client_name: '',
    client_email: '',
    client_phone: '',
    property_address: '',
    property_type: 'House',
    inspection_fee: 350,
    public_description: '',
    note: '',
    special_instructions: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setBookingDetails(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-update subject when key fields change
    if (field === 'type' || field === 'property_address') {
      const activityType = activityTypes.find(t => t.key_string === 
        (field === 'type' ? value : bookingDetails.type));
      const address = field === 'property_address' ? value : bookingDetails.property_address;
      
      if (activityType && address) {
        setBookingDetails(prev => ({
          ...prev,
          subject: `${activityType.name} - ${address.split(',')[0] || address.substring(0, 30)}`
        }));
      }
    }

    // Trigger location update for map visualization
    if (field === 'property_address' && value.length > 10) {
      onLocationUpdate?.(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newActivity = {
      id: Date.now(), // Temporary ID
      company_id: 12345,
      owner_id: selectedSlot.inspector.id,
      creator_user_id: selectedSlot.inspector.id,
      is_deleted: false,
      done: false,
      type: bookingDetails.type,
      conference_meeting_client: null,
      conference_meeting_url: null,
      conference_meeting_id: null,
      due_date: format(selectedSlot.date, 'yyyy-MM-dd'),
      due_time: `${selectedSlot.time}:00`,
      duration: bookingDetails.duration,
      busy: true,
      add_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      marked_as_done_time: null,
      subject: bookingDetails.subject,
      public_description: bookingDetails.public_description,
      note: bookingDetails.note,
      priority: 2,
      location: {
        value: bookingDetails.property_address,
        country: "Australia", 
        admin_area_level_1: "Queensland",
        admin_area_level_2: null,
        locality: "Logan",
        sublocality: null,
        route: bookingDetails.property_address.split(' ').slice(1, -3).join(' '),
        street_number: bookingDetails.property_address.split(' ')[0],
        subpremise: null,
        postal_code: bookingDetails.property_address.match(/QLD (\d{4})/)?.[1] || "4114"
      },
      org_id: Math.floor(Math.random() * 1000) + 1,
      person_id: Math.floor(Math.random() * 1000) + 1,
      deal_id: Math.floor(Math.random() * 1000) + 1,
      lead_id: `lead-${Math.random().toString(36).substr(2, 9)}`,
      project_id: null,
      attendees: [
        {
          person_id: Math.floor(Math.random() * 1000) + 1,
          primary: true,
          email: bookingDetails.client_email,
          name: bookingDetails.client_name,
          status: "accepted",
          is_organizer: false
        }
      ],
      // Custom inspection fields
      property_type: bookingDetails.property_type,
      inspection_fee: bookingDetails.inspection_fee,
      client_contact: bookingDetails.client_phone,
      special_instructions: bookingDetails.special_instructions,
      source_timezone: "Australia/Brisbane"
    };

    onBookingConfirm(newActivity);
    setIsSubmitting(false);
  };

  if (!selectedSlot) {
    return null;
  }

  const selectedActivityType = activityTypes.find(t => t.key_string === bookingDetails.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Book New Inspection</h2>
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Booking Slot Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-3">Selected Time Slot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <User className="w-4 h-4" />
                <span>{selectedSlot.inspector.name}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <Calendar className="w-4 h-4" />
                <span>{format(selectedSlot.date, 'EEEE, MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <Clock className="w-4 h-4" />
                <span>{selectedSlot.time}</span>
              </div>
            </div>
          </div>

          {/* Activity Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inspection Type
              </label>
              <select
                value={bookingDetails.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {activityTypes.map(type => (
                  <option key={type.id} value={type.key_string}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration
              </label>
              <select
                value={bookingDetails.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="01:00:00">1 Hour</option>
                <option value="01:30:00">1.5 Hours</option>
                <option value="02:00:00">2 Hours</option>
                <option value="02:30:00">2.5 Hours</option>
                <option value="03:00:00">3 Hours</option>
              </select>
            </div>
          </div>

          {/* Client Information */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={bookingDetails.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Email
                </label>
                <input
                  type="email"
                  value={bookingDetails.client_email}
                  onChange={(e) => handleInputChange('client_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Phone
                </label>
                <input
                  type="tel"
                  value={bookingDetails.client_phone}
                  onChange={(e) => handleInputChange('client_phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+61 4XX XXX XXX"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type
                </label>
                <select
                  value={bookingDetails.property_type}
                  onChange={(e) => handleInputChange('property_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="House">House</option>
                  <option value="Unit">Unit</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Property Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  value={bookingDetails.property_address}
                  onChange={(e) => handleInputChange('property_address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Main Street, Logan Central QLD 4114"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inspection Fee (AUD)
                </label>
                <input
                  type="number"
                  value={bookingDetails.inspection_fee}
                  onChange={(e) => handleInputChange('inspection_fee', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="100"
                  max="1000"
                  step="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public Description
                </label>
                <textarea
                  value={bookingDetails.public_description}
                  onChange={(e) => handleInputChange('public_description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Brief description for the client..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={bookingDetails.special_instructions}
                  onChange={(e) => handleInputChange('special_instructions', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Access instructions, special requirements, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={bookingDetails.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Internal notes for the inspector..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !bookingDetails.client_name || !bookingDetails.property_address}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Booking...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm Booking
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingSetter;