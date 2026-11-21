import React, { useState } from 'react';
import { PersonnelMember } from '../types/vermicompost';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Briefcase, 
  Phone, 
  DollarSign,
  AlertCircle,
  Building2
} from 'lucide-react';

interface PersonnelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  personnelList: PersonnelMember[];
  onUpdatePersonnelList: (updated: PersonnelMember[]) => void;
}

export const PersonnelManagerModal: React.FC<PersonnelManagerModalProps> = ({
  isOpen,
  onClose,
  personnelList,
  onUpdatePersonnelList,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formUnit, setFormUnit] = useState<PersonnelMember['unit']>('precompost');
  const [formSalary, setFormSalary] = useState<string>('14000000');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formActive, setFormActive] = useState(true);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormRole('');
    setFormUnit('precompost');
    setFormSalary('14000000');
    setFormPhone('');
    setFormNotes('');
    setFormActive(true);
    setIsAddingNew(true);
  };

  const handleStartEdit = (p: PersonnelMember) => {
    setIsAddingNew(false);
    setEditingId(p.id);
    setFormName(p.fullName);
    setFormRole(p.roleTitle);
    setFormUnit(p.unit);
    setFormSalary(p.monthlySalary.toString());
    setFormPhone(p.phone || '');
    setFormNotes(p.notes || '');
    setFormActive(p.isActive);
  };

  const handleSave = () => {
    if (!formName.trim() || !formRole.trim()) return;

    const salaryNum = Math.max(0, parseInt(formSalary.replace(/[^\d]/g, ''), 10) || 0);

    if (isAddingNew) {
      const newMember: PersonnelMember = {
        id: `per-${Date.now()}`,
        fullName: formName.trim(),
        roleTitle: formRole.trim(),
        unit: formUnit,
        monthlySalary: salaryNum,
        phone: formPhone.trim(),
        notes: formNotes.trim(),
        isActive: formActive,
        hireDate: new Date().toLocaleDateString('fa-IR'),
      };
      onUpdatePersonnelList([...personnelList, newMember]);
      setIsAddingNew(false);
    } else if (editingId) {
      const updated = personnelList.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            fullName: formName.trim(),
            roleTitle: formRole.trim(),
            unit: formUnit,
            monthlySalary: salaryNum,
            phone: formPhone.trim(),
            notes: formNotes.trim(),
            isActive: formActive,
          };
        }
        return p;
      });
      onUpdatePersonnelList(updated);
      setEditingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (personnelList.length <= 1) {
      alert('حداقل یک پرسنل باید در لیست باقی بماند.');
      return;
    }
    const updated = personnelList.filter(p => p.id !== id);
    onUpdatePersonnelList(updated);
  };

  const handleToggleActive = (id: string) => {
    const updated = personnelList.map(p => {
      if (p.id === id) return { ...p, isActive: !p.isActive };
      return p;
    });
    onUpdatePersonnelList(updated);
  };

  const totalMonthlySalary = personnelList
    .filter(p => p.isActive)
    .reduce((sum, p) => sum + (p.monthlySalary || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-right space-y-6 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-stone-900 dark:text-stone-100">
                مدیریت پرسنل و کارگران حقوق‌بگیر مجموعه
              </h2>
              <p className="text-xs text-stone-500">
                حقوق ماهانه پرسنل فعال مستقیماً در بهای تمام‌شده هر کیلوگرم محصول سرشکن می‌شود.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Payroll Banner */}
        <div className="flex items-center justify-between p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/80 dark:border-indigo-900 text-xs">
          <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-medium">
            <DollarSign className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
            <span>مجموع حقوق ماهانه پرسنل فعال ({personnelList.filter(p => p.isActive).length} نفر):</span>
          </div>
          <div className="font-mono font-bold text-base text-indigo-900 dark:text-indigo-300">
            {totalMonthlySalary.toLocaleString('fa-IR')} <span className="text-xs font-sans">تومان/ماه</span>
          </div>
        </div>

        {/* Add/Edit Form when active */}
        {(isAddingNew || editingId) && (
          <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-300 dark:border-stone-700 space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-stone-900 dark:text-stone-100">
              <span>{isAddingNew ? 'افزودن پرسنل جدید' : 'ویرایش مشخصات پرسنل'}</span>
              <button
                type="button"
                onClick={() => { setIsAddingNew(false); setEditingId(null); }}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                انصراف
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  نام و نام خانوادگی
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: مسعود رادمهر"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 text-right"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  سمت سازمانی و مسئولیت
                </label>
                <input
                  type="text"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="مثال: کارگر آماده‌سازی و دپو"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 text-right"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  حقوق ثابت ماهانه (تومان)
                </label>
                <input
                  type="number"
                  dir="rtl"
                  value={formSalary}
                  onChange={(e) => setFormSalary(e.target.value)}
                  placeholder="14000000"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono text-right"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  واحد فعالیت
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 text-right"
                >
                  <option value="precompost">واحد پیش‌کمپوست و دپو</option>
                  <option value="bed">واحد بستر و پرورش کرم</option>
                  <option value="packaging">واحد سرند و کیسه‌بندی</option>
                  <option value="lab">واحد آزمایشگاه و کنترل کیفی</option>
                  <option value="management">مدیریت و پشتیبانی</option>
                  <option value="other">متفرقه / خدمات</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  شماره تماس (اختیاری)
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono text-right"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  یادداشت / شرح وظایف
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="شرح مختصر وظایف"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>پرسنل فعال و مشمول دریافت حقوق ماهانه این دوره</span>
              </label>

              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره پرسنل</span>
              </button>
            </div>
          </div>
        )}

        {/* Personnel Table List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
              لیست پرسنل کارگاه ({personnelList.length} نفر):
            </span>
            {!isAddingNew && !editingId && (
              <button
                type="button"
                onClick={handleStartAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>افزودن نیروی جدید</span>
              </button>
            )}
          </div>

          <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
            {personnelList.map((p) => (
              <div 
                key={p.id}
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                  !p.isActive ? 'bg-stone-50/50 dark:bg-stone-900/40 opacity-60' : 'bg-white dark:bg-stone-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(p.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      p.isActive 
                        ? 'bg-emerald-700 border-emerald-700 text-white' 
                        : 'border-stone-300 dark:border-stone-700 text-transparent hover:border-stone-400'
                    }`}
                    title={p.isActive ? 'غیرفعال‌سازی موقت' : 'فعال‌سازی در حقوق این ماه'}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>

                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <span>{p.fullName}</span>
                      <span className="text-[11px] font-normal text-stone-500">({p.roleTitle})</span>
                      {!p.isActive && (
                        <span className="text-[10px] bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-1.5 py-0.2 rounded">
                          غیرفعال
                        </span>
                      )}
                    </div>
                    {p.notes && (
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {p.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-left font-mono">
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {(p.monthlySalary || 0).toLocaleString('fa-IR')}
                    </span>
                    <span className="text-[10px] text-stone-400 mr-1 font-sans">تومان/ماه</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(p)}
                      className="p-1.5 text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      title="ویرایش مشخصات"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-stone-500 hover:text-red-600 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      title="حذف پرسنل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold rounded-xl text-xs hover:bg-stone-800 transition-colors"
          >
            بستن و اعمال در بهای تمام‌شده
          </button>
        </div>

      </div>
    </div>
  );
};
