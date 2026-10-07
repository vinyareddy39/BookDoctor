import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const STATS = [
  { value: "100+",    label: "Expert Doctors",      icon: "👨‍⚕️", color: "from-primary-500 to-primary-700" },
  { value: "5,000+",  label: "Happy Patients",      icon: "😊", color: "from-accent-500 to-accent-700" },
  { value: "20,000+", label: "Appointments Booked", icon: "📅", color: "from-secondary-500 to-secondary-700" },
  { value: "4.9 ★",   label: "Average Rating",       icon: "⭐", color: "from-amber-500 to-orange-600" },
];

const SPECIALTIES = [
  { name: "Cardiologist",     emoji: "❤️",  color: "bg-red-50 text-red-700 border-red-200" },
  { name: "Dermatologist",    emoji: "🧴",  color: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: "Pediatrician",     emoji: "👶",  color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { name: "Neurologist",      emoji: "🧠",  color: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: "Orthopedist",      emoji: "🦴",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "General Physician",emoji: "🩺",  color: "bg-green-50 text-green-700 border-green-200" },
  { name: "Ophthalmologist",  emoji: "👁️",  color: "bg-teal-50 text-teal-700 border-teal-200" },
  { name: "Dentist",          emoji: "🦷",  color: "bg-sky-50 text-sky-700 border-sky-200" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Find Your Doctor",    desc: "Browse our network of verified specialists filtered by specialty, city, and availability.",  icon: "🔍", color: "bg-primary-50 border-primary-200 text-primary-600" },
  { step: "02", title: "Book a Slot",          desc: "Pick a convenient date and time slot that fits your schedule with instant confirmation.",   icon: "📅", color: "bg-accent-50 border-accent-200 text-accent-600" },
  { step: "03", title: "Visit & Get Treated",  desc: "Show up at the clinic on time. Your doctor will be ready to provide the best care.",       icon: "🏥", color: "bg-secondary-50 border-secondary-200 text-secondary-600" },
];

const TESTIMONIALS = [
  { name: "Priya Sharma",  role: "Software Engineer",  text: "Found a great cardiologist within minutes. The booking experience was flawless!",          avatar: "PS", color: "bg-rose-500" },
  { name: "Ravi Kumar",    role: "Business Owner",     text: "Used BookDoctor for my entire family. Incredibly convenient and the doctors are top-notch.", avatar: "RK", color: "bg-primary-500" },
  { name: "Anjali Mehta",  role: "Teacher",            text: "The appointment reminder and easy rescheduling saved me so much time.",                     avatar: "AM", color: "bg-accent-500" },
];

export default function Home() {
  const { isLoggedIn } = useAuth();
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "General Inquiry", message: "" });
  const [sendingContact, setSendingContact] = useState(false);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSendingContact(true);
    setTimeout(() => {
      setSendingContact(false);
      toast.success("Thank you! Your message has been received. Our team will contact you shortly.");
      setContactForm({ name: "", email: "", subject: "General Inquiry", message: "" });
    }, 600);
  };

  return (
    <div className="min-h-screen">

      {/* ─────────── HERO ─────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 text-white">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-400/20 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />

        <div className="section relative py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — Text */}
            <div className="space-y-7 animate-fade-in-up">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                Trusted by 5,000+ patients across India
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
                Book Appointments<br />
                with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 to-secondary-300">
                  Trusted Doctors
                </span>
              </h1>

              <p className="text-lg text-primary-100 max-w-lg leading-relaxed">
                Search verified specialists, view real-time availability, and book
                30-minute slots instantly — all from the comfort of your home.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link to="/doctors" className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-base">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Find Doctors
                </Link>
                <Link
                  to={isLoggedIn ? "/appointments" : "/register"}
                  className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {isLoggedIn ? "My Appointments" : "Book Appointment"}
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-2 text-sm text-primary-200">
                <span className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Free to register</span>
                <span className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Verified doctors</span>
                <span className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Instant confirmation</span>
              </div>
            </div>

            {/* Right — Illustration / Floating Cards */}
            <div className="hidden lg:flex justify-center animate-fade-in delay-200">
              <div className="relative w-80 h-80">
                {/* Central icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 bg-white/15 backdrop-blur-sm rounded-3xl border border-white/20 flex items-center justify-center text-7xl animate-float shadow-2xl">
                    🏥
                  </div>
                </div>
                {/* Floating cards */}
                {[
                  { emoji: "👨‍⚕️", label: "100+ Doctors",        top: "0%",    left: "50%",  delay: "delay-100" },
                  { emoji: "📅",   label: "Easy Booking",        top: "50%",   left: "0%",   delay: "delay-200" },
                  { emoji: "⭐",   label: "4.9 Rated",           top: "50%",   left: "100%", delay: "delay-300" },
                  { emoji: "✅",   label: "Verified Clinics",    top: "100%",  left: "50%",  delay: "delay-400" },
                ].map((card) => (
                  <div
                    key={card.label}
                    style={{ top: card.top, left: card.left }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-4 py-3 text-center shadow-lg ${card.delay} animate-float`}
                  >
                    <div className="text-2xl">{card.emoji}</div>
                    <div className="text-xs font-bold text-white mt-1 whitespace-nowrap">{card.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── STATS ─────────── */}
      <section className="py-14 bg-white border-b border-slate-100">
        <div className="section grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`card p-6 text-center group hover:shadow-card-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up delay-${(i + 1) * 100}`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl mx-auto mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                {stat.icon}
              </div>
              <p className="text-3xl font-black text-slate-800">{stat.value}</p>
              <p className="text-sm text-slate-500 font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── SPECIALTIES ─────────── */}
      <section className="py-20 bg-surface">
        <div className="section">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-primary-600 uppercase tracking-widest bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">Browse by Specialty</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 mt-4">Find the Right Specialist</h2>
            <p className="text-slate-500 mt-2 text-lg max-w-xl mx-auto">Choose from our wide network of specialized doctors across India.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {SPECIALTIES.map((sp, i) => (
              <Link
                key={sp.name}
                to={`/doctors?spec=${encodeURIComponent(sp.name)}`}
                className={`card-hover flex flex-col items-center gap-3 p-6 text-center border ${sp.color} animate-fade-in-up delay-${(i + 1) * 100}`}
              >
                <span className="text-4xl">{sp.emoji}</span>
                <span className="text-sm font-bold leading-tight">{sp.name}</span>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/doctors" className="btn-outline">
              View All Specialties
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── HOW IT WORKS ─────────── */}
      <section className="py-20 bg-white" id="how-it-works">
        <div className="section">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-accent-600 uppercase tracking-widest bg-accent-50 px-4 py-1.5 rounded-full border border-accent-100">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 mt-4">Three Simple Steps</h2>
            <p className="text-slate-500 mt-2 text-lg">Getting the care you need has never been easier.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className={`card p-8 text-center group animate-fade-in-up delay-${(i + 1) * 200}`}>
                <div className={`w-16 h-16 rounded-2xl ${step.color} border flex items-center justify-center text-3xl mx-auto mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {step.icon}
                </div>
                <div className="text-xs font-black text-slate-300 tracking-widest mb-2">STEP {step.step}</div>
                <h3 className="text-lg font-black text-slate-800 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── ABOUT US (SCROLL SECTION) ─────────── */}
      <section className="py-20 bg-slate-50/70 border-y border-slate-100" id="about">
        <div className="section space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold text-primary-600 uppercase tracking-widest bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">
              About BookDoctor
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Simplifying Healthcare, One Appointment at a Time
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              BookDoctor is an integrated modern healthcare ecosystem designed to bridge patients with top verified doctors, digital EMR records, and 24/7 emergency dispatch.
            </p>
          </div>

          {/* About Pillars Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "🔒",
                title: "Security & Privacy",
                desc: "DPDP & HIPAA aligned encrypted clinical notes, prescription vaults, and role-based audit logs.",
                border: "border-primary-200",
                bg: "bg-primary-50/50",
              },
              {
                icon: "⚡",
                title: "Instant Confirmation",
                desc: "Real-time doctor calendar slot verification with instant SMS/Email reminders and live queue tracking.",
                border: "border-accent-200",
                bg: "bg-accent-50/50",
              },
              {
                icon: "👨‍⚕️",
                title: "Verified Specialists",
                desc: "Every physician is credential-checked across 20+ clinical specialties and accredited medical clinics.",
                border: "border-secondary-200",
                bg: "bg-secondary-50/50",
              },
              {
                icon: "💛",
                title: "Patient-Centric Care",
                desc: "In-app paper prescription photo/PDF uploads, AI medication guides, and one-tap emergency hospital routing.",
                border: "border-emerald-200",
                bg: "bg-emerald-50/50",
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className={`bg-white p-6 rounded-2xl border ${pillar.border} shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 space-y-3`}
              >
                <div className={`w-12 h-12 rounded-xl ${pillar.bg} flex items-center justify-center text-2xl`}>
                  {pillar.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-base">{pillar.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>

          {/* Mission & Vision Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3 border-l-4 border-l-primary-500">
              <span className="text-3xl">🎯</span>
              <h3 className="text-xl font-black text-slate-900">Our Mission</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                To eliminate delays, fragmented paper records, and long hospital waiting rooms by providing a <strong>fast, reliable, and empathetic digital platform</strong> that connects patients with doctors in seconds.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3 border-l-4 border-l-accent-500">
              <span className="text-3xl">🌟</span>
              <h3 className="text-xl font-black text-slate-900">Our Vision</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                To empower every family with accessible, transparent, and intelligent healthcare — from daily preventive consultations to real-time emergency hospital routing and digital prescription tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── TESTIMONIALS ─────────── */}
      <section className="py-20 bg-surface">
        <div className="section">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-secondary-600 uppercase tracking-widest bg-secondary-50 px-4 py-1.5 rounded-full border border-secondary-100">Patient Stories</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 mt-4">What Our Patients Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={`card p-6 animate-fade-in-up delay-${(i + 1) * 200}`}>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, si) => (
                    <svg key={si} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white font-bold text-sm`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── CONTACT US (SCROLL SECTION) ─────────── */}
      <section className="py-20 bg-white" id="contact">
        <div className="section">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
            <span className="text-xs font-bold text-secondary-600 uppercase tracking-widest bg-secondary-50 px-4 py-1.5 rounded-full border border-secondary-100">
              Get in Touch
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              We're Here to Help You 24/7
            </h2>
            <p className="text-slate-500 text-sm sm:text-base">
              Have questions about booking appointments, doctor registrations, or emergency features? Reach out anytime.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-10 items-start">
            {/* Left Contact Info Cards */}
            <div className="lg:col-span-2 space-y-4">
              {[
                {
                  icon: "📍",
                  title: "Headquarters",
                  val: "Hyderabad, Telangana, India",
                  desc: "Central healthcare coordination center",
                  bg: "bg-blue-50 text-blue-700",
                },
                {
                  icon: "📧",
                  title: "Email Support",
                  val: "support@bookdoctor.com",
                  href: "mailto:support@bookdoctor.com",
                  desc: "Guaranteed reply within 24 hours",
                  bg: "bg-purple-50 text-purple-700",
                },
                {
                  icon: "📞",
                  title: "24/7 Helpline",
                  val: "+91 98765 43210",
                  href: "tel:+919876543210",
                  desc: "Toll-free doctor support & assistance",
                  bg: "bg-emerald-50 text-emerald-700",
                },
                {
                  icon: "🚨",
                  title: "Emergency Dispatch",
                  val: "Ambulance Hotline: 108",
                  href: "tel:108",
                  desc: "Integrated SOS GPS hospital routing",
                  bg: "bg-rose-50 text-rose-700",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 flex items-start gap-3.5 hover:bg-slate-50 transition"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${card.bg}`}>
                    {card.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {card.title}
                    </h4>
                    {card.href ? (
                      <a href={card.href} className="font-bold text-slate-800 text-sm hover:text-primary-600 transition block">
                        {card.val}
                      </a>
                    ) : (
                      <p className="font-bold text-slate-800 text-sm">{card.val}</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Contact Form */}
            <div className="lg:col-span-3 bg-slate-50/60 p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
              <h3 className="font-black text-slate-900 text-lg mb-1">Send Us a Direct Message</h3>
              <p className="text-xs text-slate-500 mb-5">
                Fill out the form below and our medical administration team will respond promptly.
              </p>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Your Full Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Rahul Verma"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Email Address *</label>
                    <input
                      required
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Inquiry Subject</label>
                  <select
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="input text-xs font-medium"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Appointment Booking Assistance">Appointment Booking Assistance</option>
                    <option value="Doctor Registration & Verification">Doctor Registration & Verification</option>
                    <option value="Prescription & Health Records">Prescription & Health Records</option>
                    <option value="Emergency Hospital Dispatch">Emergency Hospital Dispatch</option>
                    <option value="Technical Support">Technical Support</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Message *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="How can we assist you today? Please share your question or feedback..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="input text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingContact}
                  className="btn-primary w-full py-3 text-xs font-bold shadow-sm"
                >
                  {sendingContact ? "Sending Message..." : "✉️ Send Message"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── CTA Banner ─────────── */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600">
        <div className="section text-center text-white">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Ready to Book Your Appointment?</h2>
          <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of patients who trust BookDoctor for their healthcare needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              Get Started Free
            </Link>
            <Link to="/doctors" className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200">
              Browse Doctors
            </Link>
          </div>
          <p className="mt-6 text-sm text-primary-200">
            Have questions? Email us at{" "}
            <a href="mailto:findoctor@gmail.com" className="font-bold underline hover:text-white transition-colors">
              findoctor@gmail.com
            </a>
          </p>
        </div>
      </section>

    </div>
  );
}
