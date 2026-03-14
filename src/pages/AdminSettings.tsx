import { useEffect, useState, type FormEvent } from 'react';
import { Search, Settings, UserPlus, Layers3, ReceiptIndianRupee, Trash2, RefreshCw } from 'lucide-react';

type AdminUser = {
  id: number;
  name: string;
  username: string;
  role: string;
};

type AdminClass = {
  id: number;
  name: string;
  batch_names?: string[];
};

type FeeLedger = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};

type StudentFee = {
  id: number;
  type: string;
  amount: number;
  status: string;
  bill_no: string;
  date: string;
};

type StudentTransaction = {
  id: number;
  description: string;
  amount: number;
  type: string;
  date: string;
};

type StudentAccount = {
  id: number;
  name: string;
  reg_no: string;
  class_id: number;
  class_name: string;
  phone: string;
  fees: StudentFee[];
  transactions: StudentTransaction[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function AdminSettings() {
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [ledgers, setLedgers] = useState<FeeLedger[]>([]);
  const [accounts, setAccounts] = useState<StudentAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'staff' });
  const [classForm, setClassForm] = useState({ name: '', batches: '' });
  const [ledgerForm, setLedgerForm] = useState({ name: '', description: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    refreshAdminData();
  }, []);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2500);
  };

  const refreshAdminData = async () => {
    const [usersRes, classesRes, ledgersRes] = await Promise.all([
      fetch('/api/admin/users', { headers: authHeaders }),
      fetch('/api/admin/classes', { headers: authHeaders }),
      fetch('/api/admin/fee-ledgers', { headers: authHeaders }),
    ]);

    if (usersRes.ok) setUsers(await usersRes.json());
    if (classesRes.ok) setClasses(await classesRes.json());
    if (ledgersRes.ok) setLedgers(await ledgersRes.json());
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(userForm),
    });

    if (res.ok) {
      setUserForm({ name: '', username: '', password: '', role: 'staff' });
      refreshAdminData();
      notify('User created successfully');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to create user');
    }
  };

  const deleteUser = async (id: number) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    if (res.ok) {
      refreshAdminData();
      notify('User deleted successfully');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to delete user');
    }
  };

  const createClass = async (e: FormEvent) => {
    e.preventDefault();
    const batch_names = classForm.batches
      .split(',')
      .map((batch) => batch.trim())
      .filter(Boolean);

    const res = await fetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ name: classForm.name, batch_names }),
    });

    if (res.ok) {
      setClassForm({ name: '', batches: '' });
      refreshAdminData();
      notify('Class created successfully');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to create class');
    }
  };

  const createLedger = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/fee-ledgers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(ledgerForm),
    });

    if (res.ok) {
      setLedgerForm({ name: '', description: '' });
      refreshAdminData();
      notify('Fee ledger created successfully');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to create fee ledger');
    }
  };

  const searchAccounts = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setAccounts([]);
      return;
    }

    setLoadingAccounts(true);
    const res = await fetch(`/api/admin/student-account?query=${encodeURIComponent(searchQuery)}`, {
      headers: authHeaders,
    });
    const data = await res.json();
    setAccounts(data.students || []);
    setLoadingAccounts(false);
  };

  const updateStudentClass = async (studentId: number, classId: number) => {
    const res = await fetch(`/api/admin/students/${studentId}/class`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ class_id: classId }),
    });

    if (res.ok) {
      searchAccounts();
      notify('Student class updated');
    }
  };

  const updateRegistrationNumber = async (studentId: number, currentRegNo: string) => {
    const reg_no = window.prompt('Enter new registration number', currentRegNo);
    if (!reg_no || reg_no === currentRegNo) return;

    const res = await fetch(`/api/admin/students/${studentId}/reg-no`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ reg_no }),
    });

    if (res.ok) {
      searchAccounts();
      notify('Registration number updated');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to update registration number');
    }
  };

  const deleteStudent = async (studentId: number) => {
    const confirmed = window.confirm('Delete this student and related records?');
    if (!confirmed) return;

    const res = await fetch(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    if (res.ok) {
      searchAccounts();
      notify('Student deleted successfully');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to delete student');
    }
  };

  const cancelPayment = async (feeId: number) => {
    const res = await fetch(`/api/admin/fees/${feeId}/cancel`, {
      method: 'POST',
      headers: authHeaders,
    });

    if (res.ok) {
      searchAccounts();
      notify('Payment cancelled');
    } else {
      const data = await res.json();
      notify(data.error || 'Unable to cancel payment');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Settings</h1>
          <p className="text-slate-500">Manage users, classes, fee ledgers, and student account controls.</p>
        </div>
        <button
          onClick={refreshAdminData}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-indigo-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Create User</h2>
              <p className="text-sm text-slate-500">Add admin or staff users.</p>
            </div>
          </div>

          <form onSubmit={createUser} className="space-y-3">
            <input
              required
              type="text"
              placeholder="Full name"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            />
            <input
              required
              type="text"
              placeholder="Username"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
            />
            <input
              required
              type="password"
              placeholder="Password"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
            <select
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700">
              Create User
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.username} • {user.role}</p>
                </div>
                <button
                  onClick={() => deleteUser(user.id)}
                  className="rounded-lg p-2 text-rose-500 transition hover:bg-white"
                  title="Delete user"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Class Master</h2>
              <p className="text-sm text-slate-500">Create classes and batches.</p>
            </div>
          </div>

          <form onSubmit={createClass} className="space-y-3">
            <input
              required
              type="text"
              placeholder="Class name"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Batches (comma separated)"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={classForm.batches}
              onChange={(e) => setClassForm({ ...classForm, batches: e.target.value })}
            />
            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700">
              Create Class
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {classes.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">
                  {item.batch_names?.length ? item.batch_names.join(', ') : 'No batches yet'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <ReceiptIndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Fee Ledgers</h2>
              <p className="text-sm text-slate-500">Maintain fee heads and ledgers.</p>
            </div>
          </div>

          <form onSubmit={createLedger} className="space-y-3">
            <input
              required
              type="text"
              placeholder="Ledger name"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={ledgerForm.name}
              onChange={(e) => setLedgerForm({ ...ledgerForm, name: e.target.value })}
            />
            <textarea
              placeholder="Description"
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              value={ledgerForm.description}
              onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
            />
            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700">
              Create Fee Ledger
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {ledgers.map((ledger) => (
              <div key={ledger.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{ledger.name}</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
                    {ledger.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{ledger.description || 'No description'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Student Account Search</h2>
              <p className="text-sm text-slate-500">Search and manage student accounts, payments, and registration details.</p>
            </div>
          </div>

          <form onSubmit={searchAccounts} className="flex w-full max-w-xl gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, registration no, or phone"
                className="w-full rounded-xl bg-slate-50 py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
              Search
            </button>
          </form>
        </div>

        <div className="space-y-5">
          {loadingAccounts && <p className="text-sm text-slate-500">Searching accounts...</p>}
          {!loadingAccounts && accounts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-slate-500">
              Search for a student account to manage class, registration number, payments, or delete records.
            </div>
          )}

          {accounts.map((student) => (
            <div key={student.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{student.name}</h3>
                  <p className="text-sm text-slate-500">
                    {student.reg_no} • {student.class_name} • {student.phone || 'No phone'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select
                    className="rounded-xl bg-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={student.class_id}
                    onChange={(e) => updateStudentClass(student.id, Number(e.target.value))}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateRegistrationNumber(student.id, student.reg_no)}
                    className="rounded-xl bg-white px-4 py-2.5 font-semibold text-indigo-600 transition hover:bg-indigo-50"
                  >
                    Update Reg No
                  </button>
                  <button
                    onClick={() => deleteStudent(student.id)}
                    className="rounded-xl bg-rose-50 px-4 py-2.5 font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    Delete Student
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl bg-white p-4">
                  <h4 className="mb-3 font-bold text-slate-900">Payments</h4>
                  <div className="space-y-3">
                    {student.fees.length === 0 && <p className="text-sm text-slate-500">No payments found.</p>}
                    {student.fees.map((fee) => (
                      <div key={fee.id} className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{fee.type}</p>
                          <p className="text-sm text-slate-500">{fee.bill_no} • {fee.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(fee.amount)}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-700">
                            {fee.status}
                          </span>
                          {fee.status !== 'cancelled' && (
                            <button
                              onClick={() => cancelPayment(fee.id)}
                              className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                            >
                              Cancel Payment
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <h4 className="mb-3 font-bold text-slate-900">Transactions</h4>
                  <div className="space-y-3">
                    {student.transactions.length === 0 && <p className="text-sm text-slate-500">No transactions found.</p>}
                    {student.transactions.map((transaction) => (
                      <div key={transaction.id} className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{transaction.description}</p>
                          <span className={`text-sm font-bold ${transaction.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{transaction.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
