import { useState } from "react";
import toast from "react-hot-toast";

const INFO_CARDS = [
  {
    icon: "📍",
    label: "Location",
    value: "Hyderabad, Telangana, India",
    color: "bg-primary-50 border-primary-100",
    dot:   "bg-primary-500",
  },
  {
    icon: "📧",
    label: "Email",
    value: "support@bookdoctor.com",
    href:  "mailto:support@bookdoctor.com",
    color: "bg-accent-50 border-accent-100",
    dot:   "bg-accent-500",
  },
  {
    icon: "📞",
    label: "Phone",
    value: "+91 98765 43210",
    href:  "tel:+919876543210",
    color: "bg-secondary-50 border-secondary-100",
    dot:   "bg-secondary-500",
  },
  {
    icon: "🌐",
    label: "Website",
    value: "book-doctor-six.vercel.app",
    href:  "https://book-doctor-six.vercel.app/",
    color: "bg-green-50 border-green-100",
    dot:   "bg-green-500",
  },
];

const SUBJECTS = [
  "General Inquiry",
  "Appointment Help",
  "Doctor Registration",
  "Technical Support",
  "Feedback / Suggestions",
  "Bug Report",
  "Other",
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [sending, setSending] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, message } = form;
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSending(true);
    // Simulate sending (replace with real API call if needed)
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);

    toast.success("Message sent! We'll get back to you shortly. 🎉");
    setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  };

  return (
    <div className="min-h-screen bg-surface">

      {/* ── Hero Banner ── */}
      <section className="bg-gradient-to-br from-secondary-600 via-secondary-700 to-primary-700 text-white py-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in-up space-y-4">
          <span className="text-xs font-extrabold uppercase tracking-widest bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
            We're Here to Help
          </span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            Get in <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 to-primary-300">Touch</span>
          </h1>
          <p className="text-secondary-100 text-lg max-w-xl mx-auto leading-relaxed">
            Have questions or need assistance? Our support team is available and ready to help you.
          </p>
        </div>
      </section>

      {/* ── Main Layout ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-12">

          {/* Left: Info Cards */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <span className="text-xs font-bold text-secondary-600 uppercase tracking-widest bg-secondary-50 px-4 py-1.5 rounded-full border border-secondary-100">
                Contact Info
              </span>
              <h2 className="text-2xl font-black text-slate-800 mt-4 mb-2">Contact Details</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Reach out through any of the channels below. We typically respond within 24 hours.
              </p>
            </div>

            {INFO_CARDS.map((card) => (
              <div key={card.label} className={`card p-5 flex items-start gap-4 border ${card.color} hover:shadow-card-lg hover:-translate-y-0.5 transition-all duration-300`}>
                <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">{card.label}</p>
                  {card.href ? (
                    <a href={card.href} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-700 hover:text-primary-600 transition-colors break-all">
                      {card.value}
                    </a>
                  ) : (
                    <p className="text-sm font-bold text-slate-700">{card.value}</p>
                  )}
                </div>
                <span className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 mt-1 ${card.dot}`} />
              </div>
            ))}

            {/* Response badge */}
            <div className="card p-5 bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-100 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <p className="font-bold text-slate-700 text-sm">Average Response Time</p>
              <p className="text-2xl font-black text-primary-600 mt-1">Under 24 hrs</p>
              <p className="text-xs text-slate-400 mt-1">Monday – Saturday, 9 AM – 6 PM IST</p>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="lg:col-span-3">
            <div className="card p-8 shadow-card-lg">
              <div className="mb-7">
                <span className="text-xs font-bold text-primary-600 uppercase tracking-widest bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">
                  Send a Message
                </span>
                <h2 className="text-2xl font-black text-slate-800 mt-4 mb-1">We'd Love to Hear from You</h2>
                <p className="text-slate-500 text-sm">Fill in the form and we'll be in touch as soon as possible.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                {/* Name + Email row */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className="input-label">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={form.name}
                      onChange={set("name")}
                      required
                      placeholder="Your full name"
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="input-label">
                      Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      required
                      placeholder="you@email.com"
                      className="input"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="contact-subject" className="input-label">Subject</label>
                  <select
                    id="contact-subject"
                    value={form.subject}
                    onChange={set("subject")}
                    className="input cursor-pointer"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="contact-message" className="input-label">
                    Message <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    value={form.message}
                    onChange={set("message")}
                    required
                    rows={6}
                    placeholder="Describe your question or issue in detail…"
                    className="input resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1.5 text-right">{form.message.length} characters</p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  id="contact-submit-btn"
                  disabled={sending}
                  className="btn-primary w-full justify-center py-4 text-base"
                >
                  {sending ? (
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending your message…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Message
                    </span>
                  )}
                </button>

                <p className="text-xs text-slate-400 text-center">
                  By submitting, you agree to our{" "}
                  <span className="text-primary-600 font-semibold cursor-pointer hover:underline">Privacy Policy</span>.
                  We never share your information.
                </p>

              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Map / Location Banner ── */}
      <section className="pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="card overflow-hidden border border-slate-100">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center gap-3">
              <span className="text-xl">📍</span>
              <div>
                <p className="text-white font-bold text-sm">Our Location</p>
                <p className="text-slate-400 text-xs">Hyderabad, Telangana, India</p>
              </div>
            </div>
            <div className="h-64 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="text-5xl">🗺️</div>
                <p className="text-slate-600 font-bold">Hyderabad, Telangana</p>
                <a
                  href="https://maps.google.com/?q=Hyderabad,Telangana,India"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-primary-100 hover:shadow-md transition-all"
                >
                  Open in Google Maps →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
