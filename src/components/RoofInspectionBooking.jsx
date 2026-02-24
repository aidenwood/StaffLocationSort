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
  Check,
  X 
} from 'lucide-react';

const RoofInspectionBooking = ({ selectedSlot, onBookingConfirm, onCancel, onLocationUpdate }) => {
  const [bookingDetails, setBookingDetails] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    property_address: '',
    roof_type: 'Metal Roof',
    duration: '01:00:00', // Default 1 hour
    special_instructions: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const roofTypes = [
    'Metal Roof',
    'Decramastic roof tiles', 
    'Asbestos roof',
    'Mixed'
  ];

  const durationOptions = [
    { value: '01:00:00', label: '1 Hour' },
    { value: '01:30:00', label: '1.5 Hours' },
    { value: '02:00:00', label: '2 Hours' }
  ];

  const handleInputChange = (field, value) => {
    setBookingDetails(prev => ({
      ...prev,
      [field]: value
    }));

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
      id: Date.now(),
      company_id: 12345,
      owner_id: selectedSlot.inspector.id,
      creator_user_id: selectedSlot.inspector.id,
      is_deleted: false,
      done: false,
      type: 'roof_inspection',
      due_date: format(selectedSlot.date, 'yyyy-MM-dd'),
      due_time: `${selectedSlot.time}:00`,
      duration: bookingDetails.duration,
      busy: true,
      add_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      subject: `Roof Inspection - Hail Damage - ${bookingDetails.property_address.split(',')[0] || bookingDetails.property_address.substring(0, 30)}`,
      public_description: `Professional roof inspection for hail damage assessment at ${bookingDetails.property_address}`,
      note: bookingDetails.special_instructions,
      priority: 2,
      location: {
        value: bookingDetails.property_address,
        country: "Australia", 
        admin_area_level_1: "Queensland",
        locality: "Logan",
        route: bookingDetails.property_address.split(' ').slice(1, -3).join(' '),
        street_number: bookingDetails.property_address.split(' ')[0],
        postal_code: bookingDetails.property_address.match(/QLD (\d{4})/)?.[1] || "4114"
      },
      org_id: Math.floor(Math.random() * 1000) + 1,
      person_id: Math.floor(Math.random() * 1000) + 1,
      deal_id: Math.floor(Math.random() * 1000) + 1,
      lead_id: `lead-${Math.random().toString(36).substr(2, 9)}`,
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
      // Roof inspection specific fields
      roof_type: bookingDetails.roof_type,
      inspection_fee: 350, // Standard roof inspection fee
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Book Roof Inspection</h2>
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-sm text-gray-600 mt-1">Hail Damage Assessment</div>
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
                <span>{format(selectedSlot.date, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <Clock className="w-4 h-4" />
                <span>{selectedSlot.time}</span>
              </div>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inspection Duration
            </label>
            <select
              value={bookingDetails.duration}
              onChange={(e) => handleInputChange('duration', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {durationOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Property Details */}
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
                Roof Type
              </label>
              <select
                value={bookingDetails.roof_type}
                onChange={(e) => handleInputChange('roof_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {roofTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Information */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Client Information</h3>
            <div className="space-y-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              value={bookingDetails.special_instructions}
              onChange={(e) => handleInputChange('special_instructions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Access instructions, specific damage areas to focus on, etc."
            />
          </div>

          {/* Fee Display */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-green-900">Inspection Fee</div>
                <div className="text-sm text-green-700">Standard roof inspection for hail damage</div>
              </div>
              <div className="text-2xl font-bold text-green-600">$350</div>
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

export default RoofInspectionBooking;