import React, { useEffect, useMemo, useState } from "react";
import { User } from "../types";
import { eventService, EventItem, EventRegistrationItem } from "../services/events";
import { QRCodeSVG } from "qrcode.react";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

type Props = {
  user: User;
};

const StudentEventsPage: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myRegs, setMyRegs] = useState<EventRegistrationItem[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [viewTicket, setViewTicket] = useState<{ event: EventItem; reg: EventRegistrationItem } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [list, regs] = await Promise.all([
      eventService.listVisible(user),
      eventService.listMyRegistrations(user),
    ]);
    setEvents(list);
    setMyRegs(regs);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  const posterUrl = useMemo(() => {
    const url = selected?.poster?.url;
    if (!url) return null;
    try {
      return new URL(String(url), API_BASE_URL).toString();
    } catch {
      return String(url);
    }
  }, [selected?.poster?.url]);

  const openRegister = (ev: EventItem) => {
    setSelected(ev);
    setAnswers({});
    setToast(null);
    setError(null);
  };

  const submit = async () => {
    if (!selected) return;
    setToast(null);
    setError(null);

    // Validation
    const requiredFields = (selected.formFields || []).filter(f => f.required);
    for (const f of requiredFields) {
      if (!answers[f.key]?.trim()) {
        setError(`Please fill the required field: ${f.label}`);
        return;
      }
    }

    setRegistering(true);
    const res = await eventService.register(user, selected.id, answers);
    setRegistering(false);
    if (res.success) {
      setToast("Registered successfully.");
      setSelected(null);
      refresh();
      return;
    }
    setError(res.message || "Registration failed");
  };

  const getMyReg = (eventId: string) => myRegs.find((r) => r.eventId === eventId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Student Home • Events</h2>
            <p className="mt-2 text-slate-500 font-bold">Events visible for your department ({user.department}).</p>
          </div>
          <button onClick={refresh} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs border border-slate-200">
            Refresh
          </button>
        </div>

        {(toast || error) && (
          <div
            className={`mt-5 p-4 rounded-2xl border font-bold ${error ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}
          >
            {error || toast}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500 font-bold">Loading…</p>
        ) : events.length === 0 ? (
          <div className="mt-6 p-10 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
            <p className="font-black text-slate-800">No events yet.</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Ask event managers to publish posters and registration forms.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => {
              const reg = getMyReg(ev.id);
              return (
                <div key={ev.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                      Event
                    </span>
                    {reg && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        Registered
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      {ev.allowedDepartments?.length ? ev.allowedDepartments.join(", ") : "All Departments"}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-black text-slate-800">{ev.title}</h3>
                  <p className="mt-2 text-slate-600 font-bold whitespace-pre-wrap line-clamp-3">{ev.description}</p>

                  <div className="mt-4 text-sm font-bold text-slate-500 flex-grow">
                    <p>Venue: {ev.venue || "—"}</p>
                    <p>Starts: {new Date(ev.startAt).toLocaleString()}</p>
                  </div>

                  {ev.poster?.url ? (
                    <div className="mt-4">
                      <img
                        alt="Event poster"
                        className="w-full h-40 object-cover rounded-2xl border border-slate-100"
                        src={new URL(String(ev.poster.url), API_BASE_URL).toString()}
                      />
                    </div>
                  ) : null}

                  <div className="mt-5 flex gap-3 flex-wrap">
                    {reg ? (
                      <button
                        onClick={() => setViewTicket({ event: ev, reg })}
                        className="px-5 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                      >
                        🎟️ View Ticket / QR
                      </button>
                    ) : (
                      <button
                        onClick={() => openRegister(ev)}
                        className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all"
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Register • {selected.title}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">Fill the form and submit.</p>
              </div>
              <button className="text-slate-500 font-black" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            {posterUrl ? (
              <img
                alt="Poster"
                src={posterUrl}
                className="mt-4 w-full rounded-2xl border border-slate-100 max-h-[40vh] object-contain bg-slate-50"
              />
            ) : null}

            <div className="mt-5 space-y-4">
              {(selected.formFields || []).length === 0 ? (
                <p className="text-sm font-bold text-slate-500">No extra fields. Click submit to register.</p>
              ) : (
                (selected.formFields || []).map((f) => (
                  <div key={f.key}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {f.label} {f.required ? "*" : ""}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        value={answers[f.key] || ""}
                        onChange={(e) => setAnswers((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="mt-2 w-full min-h-[90px] p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={answers[f.key] || ""}
                        onChange={(e) => setAnswers((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="mt-2 w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                      >
                        <option value="">Select…</option>
                        {(f.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={answers[f.key] || ""}
                        onChange={(e) => setAnswers((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="mt-2 w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                      />
                    )}
                  </div>
                ))
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setSelected(null)}
                  className="px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  disabled={registering}
                  onClick={submit}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
                >
                  {registering ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewTicket && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewTicket(null)}>
          <div
            className="w-full max-w-md bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
              🎟️
            </div>
            <h3 className="text-2xl font-black text-slate-800">{viewTicket.event.title}</h3>
            <p className="mt-2 text-slate-500 font-bold">Registration Ticket</p>

            <div className="mt-8 bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col items-center">
              <QRCodeSVG
                value={user.roll_number || user.email}
                size={200}
                level="H"
                includeMargin={true}
                className="rounded-xl"
              />
              <p className="mt-6 font-black text-slate-800 text-lg uppercase tracking-widest">
                {user.roll_number || user.email}
              </p>
              <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.2em]">Scan for Attendance</p>
              {!user.roll_number && (
                <p className="mt-4 p-3 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold rounded-xl">
                  ⚠️ Roll number not set in profile. Using email for ticket.
                </p>
              )}
            </div>

            <div className="mt-8 space-y-2 text-sm font-bold text-slate-500 text-left bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="text-slate-800">{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Roll No:</span>
                <span className="text-slate-800">{user.roll_number || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Dept:</span>
                <span className="text-slate-800">{user.department}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={viewTicket.reg.isPresent ? "text-emerald-600" : "text-amber-600"}>
                  {viewTicket.reg.isPresent ? "Present ✅" : "Registered 📋"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setViewTicket(null)}
              className="mt-8 w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-slate-900 transition-all uppercase tracking-widest"
            >
              Close Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentEventsPage;
