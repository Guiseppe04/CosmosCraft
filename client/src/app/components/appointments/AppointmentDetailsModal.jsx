import React from 'react';
import { format } from 'date-fns';

const AppointmentDetailsModal = ({ show, onClose, appointment, onEdit, onCancel, onComplete }) => {
  if (!show || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-black text-xl font-bold">&times;</button>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Appointment Details</h2>
          <button onClick={onEdit} className="ml-2 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm font-semibold">Edit</button>
        </div>
        <div className="space-y-4">
          <div>
            <h6 className="font-semibold text-xs text-gray-500">Reference Number</h6>
            <p>{appointment.referenceNumber}</p>
            <h6 className="font-semibold text-xs text-gray-500 mt-2">Status</h6>
            <p className={`capitalize font-semibold ${appointment.status?.toLowerCase() === 'completed' ? 'text-green-600' : appointment.status?.toLowerCase() === 'cancelled' ? 'text-red-600' : 'text-yellow-600'}`}>{appointment.status}</p>
          </div>
          <div>
            <h6 className="font-semibold text-xs text-gray-500">Customer Information</h6>
            <p>{appointment.customerName}</p>
            <p>{appointment.customerEmail}</p>
            <p>{appointment.customerPhone}</p>
          </div>
          <div>
            <h6 className="font-semibold text-xs text-gray-500">Service</h6>
            <p>{appointment.service}</p>
            <h6 className="font-semibold text-xs text-gray-500 mt-2">Duration</h6>
            <p>{appointment.duration} minutes</p>
            <h6 className="font-semibold text-xs text-gray-500 mt-2">Date</h6>
            <p>{format(new Date(appointment.date), 'MMMM dd, yyyy')}</p>
            <h6 className="font-semibold text-xs text-gray-500 mt-2">Time</h6>
            <p>{format(new Date(appointment.date), 'hh:mm a')}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm font-semibold">Close</button>
          <button onClick={onEdit} className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold">Edit</button>
          <button onClick={onCancel} className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">Cancel</button>
          <button onClick={onComplete} className="px-4 py-2 rounded bg-green-500 hover:bg-green-600 text-white text-sm font-semibold">Complete</button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailsModal;