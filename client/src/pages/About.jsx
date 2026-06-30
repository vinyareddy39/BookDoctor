import { Link } from "react-router-dom";

const TEAM = [
  { name: "Sri Vinya Reddy", role: "Full Stack Developer", emoji: "👩‍💻", color: "from-primary-500 to-primary-700" },
  { name: "Dr. Advisor",     role: "Healthcare Consultant", emoji: "👨‍⚕️", color: "from-accent-500 to-accent-700" },
  { name: "UI/UX Designer",  role: "Product Designer",      emoji: "🎨", color: "from-secondary-500 to-secondary-700" },
];

const VALUES = [
  { icon: "🔒", title: "Security First",    desc: "All patient data is encrypted and stored securely. Privacy is our top priority." },
  { icon: "⚡", title: "Instant Booking",   desc: "Real-time slot availability with instant confirmation — no waiting, no calls." },
  { icon: "✅", title: "Verified Doctors",  desc: "Every doctor on our platform is verified with valid credentials and licenses." },
  { icon: "💛", title: "Patient Centric",   desc: "Built around patient experience — easy to use, accessible from any device." },
];

export default function About() {
  return (
    <div className="min-h-screen bg-surface">

      {/* ── Hero Banner ── */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 text-white py-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-400/20 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in-up space-y-4">
          <span className="text-xs font-extrabold uppercase tracking-widest bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
            Our Story
          </span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 to-secondary-300">BookDoctor</span>
          </h1>
          <p className="text-primary-100 text-lg max-w-2xl mx-auto leading-relaxed">
            A modern healthcare platform designed to make doctor appointments simple, fast, and accessible for everyone across India.
          </p>
        </div>
      </section>

      {/* ── About Section ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div className="space-y-5 animate-fade-in-up">
              <span className="text-xs font-bold text-primary-600 uppercase tracking-widest bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">
                Who We Are
              </span>
              <h2 className="text-3xl font-black text-slate-800 leading-tight">
                Simplifying Healthcare, One Appointment at a Time
              </h2>
              <p className="text-slate-600 leading-relaxed">
                <strong>BookDoctor</strong> is an online doctor appointment booking platform designed to make healthcare more accessible and convenient. Patients can easily search for doctors, view their profiles, and book appointments based on availability.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Doctors can efficiently manage appointments, update their schedules, and provide better patient care through a centralized dashboard — reducing paperwork and administrative overhead.
              </p>
              <Link to="/doctors" className="btn-primary inline-flex mt-2">
                Find Doctors Now
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Stats card */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
              {[
                { value: "100+",    label: "Expert Doctors",      emoji: "👨‍⚕️", color: "bg-primary-50 border-primary-100 text-primary-700" },
                { value: "5,000+",  label: "Happy Patients",      emoji: "😊", color: "bg-green-50 border-green-100 text-green-700" },
                { value: "20,000+", label: "Appointments Booked", emoji: "📅", color: "bg-secondary-50 border-secondary-100 text-secondary-700" },
                { value: "4.9 ★",   label: "Average Rating",      emoji: "⭐", color: "bg-amber-50 border-amber-100 text-amber-700" },
              ].map((s) => (
                <div key={s.label} className={`card p-5 text-center border ${s.color} hover:shadow-card-lg hover:-translate-y-1 transition-all duration-300`}>
                  <div className="text-3xl mb-2">{s.emoji}</div>
                  <p className="text-2xl font-black text-slate-800">{s.value}</p>
                  <p className="text-xs font-bold mt-1 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission & Vision ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-accent-600 uppercase tracking-widest bg-accent-50 px-4 py-1.5 rounded-full border border-accent-100">
              What Drives Us
            </span>
            <h2 className="text-3xl font-black text-slate-800 mt-4">Mission & Vision</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission */}
            <div className="card p-8 border-l-4 border-primary-500 space-y-4">
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-3xl border border-primary-100">
                🎯
              </div>
              <h3 className="text-xl font-black text-slate-800">Our Mission</h3>
              <p className="text-slate-600 leading-relaxed">
                To simplify the appointment booking process by providing a <strong>secure, reliable, and user-friendly platform</strong> that connects patients with trusted healthcare professionals — anytime, anywhere.
              </p>
            </div>

            {/* Vision */}
            <div className="card p-8 border-l-4 border-accent-500 space-y-4">
              <div className="w-14 h-14 bg-accent-50 rounded-2xl flex items-center justify-center text-3xl border border-accent-100">
                🔭
              </div>
              <h3 className="text-xl font-black text-slate-800">Our Vision</h3>
              <p className="text-slate-600 leading-relaxed">
                To create a <strong>digital healthcare experience</strong> that enables patients and doctors to connect seamlessly, making quality healthcare more accessible for everyone across India and beyond.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Values ── */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-secondary-600 uppercase tracking-widest bg-secondary-50 px-4 py-1.5 rounded-full border border-secondary-100">
              Our Core Values
            </span>
            <h2 className="text-3xl font-black text-slate-800 mt-4">What We Stand For</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map((v, i) => (
              <div key={v.title} className={`card p-6 flex gap-5 items-start animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                  {v.icon}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 mb-1">{v.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary-600 to-secondary-600 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-3xl font-black">Ready to Experience Better Healthcare?</h2>
          <p className="text-primary-100 text-lg">Join thousands of patients who trust BookDoctor for their healthcare needs.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              Get Started Free
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
