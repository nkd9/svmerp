import React, { useState, useEffect } from 'react';
import { Home, Bed, UserCheck, Search, Plus, MapPin, X, Save } from 'lucide-react';
import { format } from 'date-fns';

export default function Hostel() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isHostelModalOpen, setIsHostelModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isAllotmentModalOpen, setIsAllotmentModalOpen] = useState(false);
  
  const [hostelForm, setHostelForm] = useState({ name: '', type: 'Boys' });
  const [roomForm, setRoomForm] = useState({ hostel_id: '', room_no: '', capacity: '4' });
  const [allotmentForm, setAllotmentForm] = useState({ student_id: '', room_id: '', bed_no: '', start_date: format(new Date(), 'yyyy-MM-dd') });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [hostelsRes, roomsRes, studentsRes] = await Promise.all([
      fetch('/api/hostels', { headers }),
      fetch('/api/rooms', { headers }),
      fetch('/api/students?status=active&view=summary&limit=200', { headers })
    ]);
    setHostels(await hostelsRes.json());
    setRooms(await roomsRes.json());
    setStudents(await studentsRes.json());
    setLoading(false);
  };

  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/hostels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(hostelForm)
    });
    if (res.ok) {
      setIsHostelModalOpen(false);
      fetchData();
      setHostelForm({ name: '', type: 'Boys' });
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(roomForm)
    });
    if (res.ok) {
      setIsRoomModalOpen(false);
      fetchData();
      setRoomForm({ hostel_id: '', room_no: '', capacity: '4' });
    }
  };

  const handleAllotment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/hostel-allotments', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(allotmentForm)
    });
    if (res.ok) {
      setIsAllotmentModalOpen(false);
      fetchData();
      setAllotmentForm({ student_id: '', room_id: '', bed_no: '', start_date: format(new Date(), 'yyyy-MM-dd') });
      alert('Room allotted successfully!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hostel Management</h1>
          <p className="text-slate-500">Manage hostels, rooms, and student allotments.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsHostelModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Hostel
          </button>
          <button 
            onClick={() => setIsAllotmentModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-200"
          >
            <UserCheck className="w-5 h-5" />
            New Allotment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Hostel Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4">Hostels</h3>
            <div className="space-y-4">
              {hostels.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No hostels created yet.</p>
              ) : (
                hostels.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Home className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-semibold text-slate-700">{h.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{h.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white">
            <Bed className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="text-lg font-bold">Total Capacity</h3>
            <p className="text-3xl font-bold mt-1">120 Beds</p>
            <p className="text-indigo-100 text-sm mt-2">45 Beds Available</p>
          </div>
        </div>

        {/* Room Grid */}
        <div className="lg:col-span-3 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-900">Room Status</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                <span className="text-xs text-slate-500">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-rose-500 rounded-full"></span>
                <span className="text-xs text-slate-500">Full</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {rooms.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                <p>No rooms found. Add rooms to get started.</p>
              </div>
            ) : (
              rooms.map(room => (
                <div key={room.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400">#{room.room_no}</span>
                    <div className={`w-2 h-2 rounded-full ${room.capacity > 2 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                  </div>
                  <p className="text-sm font-bold text-slate-900">Room {room.room_no}</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{room.hostel_name}</p>
                  <div className="mt-3 flex items-center gap-1">
                    {[...Array(parseInt(room.capacity))].map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></div>
                    ))}
                  </div>
                </div>
              ))
            )}
            <button 
              onClick={() => setIsRoomModalOpen(true)}
              className="p-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all gap-1"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase">Add Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hostel Modal */}
      {isHostelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Add New Hostel</h3>
              <button onClick={() => setIsHostelModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateHostel} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Hostel Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={hostelForm.name}
                  onChange={(e) => setHostelForm({...hostelForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Type</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={hostelForm.type}
                  onChange={(e) => setHostelForm({...hostelForm, type: e.target.value})}
                >
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Save Hostel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Room Modal */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Add New Room</h3>
              <button onClick={() => setIsRoomModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Hostel</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={roomForm.hostel_id}
                  onChange={(e) => setRoomForm({...roomForm, hostel_id: e.target.value})}
                >
                  <option value="">Choose Hostel</option>
                  {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Room Number</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={roomForm.room_no}
                  onChange={(e) => setRoomForm({...roomForm, room_no: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Capacity (Beds)</label>
                <input 
                  required
                  type="number" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({...roomForm, capacity: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Save Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Allotment Modal */}
      {isAllotmentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">New Room Allotment</h3>
              <button onClick={() => setIsAllotmentModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAllotment} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Student</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={allotmentForm.student_id}
                  onChange={(e) => setAllotmentForm({...allotmentForm, student_id: e.target.value})}
                >
                  <option value="">Choose Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.reg_no})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Room</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={allotmentForm.room_id}
                  onChange={(e) => setAllotmentForm({...allotmentForm, room_id: e.target.value})}
                >
                  <option value="">Choose Room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.hostel_name} - Room {r.room_no}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Bed Number</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={allotmentForm.bed_no}
                  onChange={(e) => setAllotmentForm({...allotmentForm, bed_no: e.target.value})}
                  placeholder="e.g. A1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Start Date</label>
                <input 
                  required
                  type="date" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={allotmentForm.start_date}
                  onChange={(e) => setAllotmentForm({...allotmentForm, start_date: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Confirm Allotment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
