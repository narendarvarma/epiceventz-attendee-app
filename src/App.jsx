import { useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const COPYRIGHT_YEAR = new Date().getFullYear()
const CURRENT_DATE_LABEL = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).toUpperCase()
const SUGGESTIONS = [
  'Find events near Hyderabad',
  'Show concerts this weekend',
  'Find events under ₹1,000',
  'Discover technology conferences',
  'Compare ticket categories',
  'Help me find my ticket',
]

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed.')
    error.status = response.status
    error.retryAfter = Number(response.headers.get('Retry-After')) || 0
    throw error
  }
  return data
}

function formatDate(value) {
  if (!value) return 'Date to be announced'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? 'Date to be announced'
    : date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

function formatPrice(value) {
  if (value == null || value === '') return 'Price unavailable'
  return `₹${Number(value).toLocaleString('en-IN')}`
}

function getPrice(event, category = 'General') {
  if (category === 'VIP') return event?.VIP_Ticket_Price__c ?? null
  return event?.General_Ticket_Price__c ?? event?.Ticket_Price__c ?? null
}

function isPaidTicket(ticket) {
  return ticket.paymentStatus === 'Paid'
}

function isUpcomingTicket(ticket) {
  return ticket.eventDate >= new Date().toISOString().slice(0, 10) &&
    ticket.paymentStatus === 'Paid' &&
    ticket.ticketStatus === 'Confirmed'
}

function Logo() {
  return <a className="logo" href="/">Epic<span>Eventz</span></a>
}

function Header({ authenticated, onSignOut, error }) {
  return (
    <>
      <header className="site-header">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/#events">Explore events</a>
          <a href="/ai-assistant">AI event assistant</a>
          {authenticated && <a href="/account">Dashboard</a>}
          {authenticated && <a href="/my-tickets">My tickets</a>}
        </nav>
        <div className="header-actions">
          {authenticated
            ? <><a className="button button-quiet account-link" href="/account">My account</a><button className="button button-outline" onClick={onSignOut}>Sign out</button></>
            : <a className="button button-outline" href="/login">Log in</a>}
        </div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation menu">Menu</summary>
          <nav aria-label="Mobile navigation">
            <a href="/">Home</a>
            <a href="/#events">Explore events</a>
            <a href="/ai-assistant">AI event assistant</a>
            {authenticated && <a href="/account">Dashboard</a>}
            {authenticated && <a href="/my-tickets">My tickets</a>}
            {authenticated && <a href="/booking-history">Booking history</a>}
            {authenticated && <a href="/spending">My spending</a>}
            {authenticated && <a href="/cancellations">Cancellations</a>}
            {authenticated && <a href="/feedback">Feedback</a>}
            {authenticated
              ? <button onClick={onSignOut}>Sign out</button>
              : <><a href="/login">Log in</a><a href="/#events">Register by booking</a></>}
          </nav>
        </details>
      </header>
      {error && <div className="global-error" role="alert">{error}</div>}
    </>
  )
}

function EventCard({ event, onBook, compact = false, showCategories = false }) {
  const price = event.recommendedPrice ?? getPrice(event, event.recommendedCategory || 'General')
  const category = event.recommendedCategory || 'General'
  const remaining = category === 'VIP'
    ? event.VIP_Tickets_Remaining__c
    : event.General_Tickets_Remaining__c
  const capacity = category === 'VIP'
    ? event.VIP_Ticket_Capacity__c
    : (event.General_Ticket_Capacity__c ?? event.Ticket_Capacity__c)
  const soldOut = (capacity != null && Number(capacity) <= 0) ||
    (remaining != null && Number(remaining) <= 0)
  return (
    <article className={`event-card${compact ? ' event-card-compact' : ''}`}>
      <a className="event-art" href={`/events/${encodeURIComponent(event.Id)}`} aria-label={`View ${event.Name}`}>
        <span className="art-orbit art-orbit-one" />
        <span className="art-orbit art-orbit-two" />
        <span className="art-brand">EPICEVENTZ</span>
        <span className="art-caption">A moment worth remembering</span>
      </a>
      <div className="event-card-body">
        <p className="event-meta">{formatDate(event.Event_Date__c)}</p>
        <h3><a href={`/events/${encodeURIComponent(event.Id)}`}>{event.Name}</a></h3>
        <p className="event-venue">{event.Venue__c || 'Venue not provided'}</p>
        {remaining != null && <p className="event-availability">{soldOut ? 'Sold out' : `${remaining} ${category} tickets remaining`}</p>}
        {event.recommendationReason && <p className="recommendation-reason">{event.recommendationReason}</p>}
        {showCategories && event.categories?.length > 0 ? (
          <div className="assistant-ticket-options">
            {event.categories.map((ticket) => (
              <div className="assistant-ticket-option" key={ticket.name}>
                <div><strong>{ticket.name}</strong><span>{formatPrice(ticket.price)}</span><small>{ticket.availability == null ? 'Availability not provided' : ticket.available ? `${ticket.availability} remaining` : 'Sold out'}</small></div>
                <button className="button button-primary button-small" disabled={!ticket.available} onClick={() => onBook(event, ticket.name)}>{ticket.available ? 'Select' : 'Sold out'}</button>
              </div>
            ))}
          </div>
        ) : <div className="event-card-footer">
          <div><strong>{formatPrice(price)}</strong><span> · {category}</span></div>
          <button className="button button-primary button-small" disabled={soldOut} onClick={() => onBook(event, category)}>{soldOut ? 'Sold out' : 'Book tickets'}</button>
        </div>}
        <a className="event-details-link" href={`/events/${encodeURIComponent(event.Id)}`}>View details <span>↗</span></a>
      </div>
    </article>
  )
}

function EventCollection({ events, loading, error, onRetry, onBook }) {
  if (loading) return <div className="event-grid" aria-label="Loading events">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item} />)}</div>
  if (error) return <div className="state-card"><h3>Events couldn’t be loaded</h3><p>{error}</p><button className="button button-outline" onClick={onRetry}>Try again</button></div>
  if (!events.length) return <div className="state-card"><span className="state-icon">✦</span><h3>Nothing on the calendar just yet</h3><p>When events are added, you’ll find them here. Check back soon.</p></div>
  return <div className="event-grid">{events.map((event) => <EventCard key={event.Id} event={event} onBook={onBook} />)}</div>
}

function BookingDialog({ event, initialCategory, onClose, authenticated, email, onBooked }) {
  const [name, setName] = useState('')
  const [attendeeEmail, setAttendeeEmail] = useState(email || '')
  const [category, setCategory] = useState(initialCategory || 'General')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [registration, setRegistration] = useState(null)
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentDone, setPaymentDone] = useState(false)
  const [paymentResult, setPaymentResult] = useState(null)
  const [paymentMessage, setPaymentMessage] = useState('')

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function submitBooking(eventObject) {
    eventObject.preventDefault()
    if (busy || registration) return
    setBusy(true)
    setMessage('Creating your reservation…')
    try {
      const data = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          eventId: event.Id,
          attendeeName: name.trim(),
          attendeeEmail: attendeeEmail.trim(),
          ticketCategory: category,
        }),
      })
      if (!data.success || !data.registrationNumber) {
        throw new Error('The server did not confirm the reservation.')
      }
      setRegistration(data)
      setMessage('')
      onBooked()
    } catch (error) {
      setMessage(error.message || 'Could not create the reservation.')
    } finally {
      setBusy(false)
    }
  }

  async function demoCheckout(outcome) {
    if (!registration || paymentBusy || paymentDone) return
    setPaymentBusy(true)
    setPaymentMessage('Validating demo checkout with the server…')
    try {
      const checkout = await apiRequest('/api/demo-payment/start', {
        method: 'POST',
        body: JSON.stringify({
          registrationNumber: registration.registrationNumber,
          email: attendeeEmail.trim(),
        }),
      })
      const result = await apiRequest('/api/demo-payment/complete', {
        method: 'POST',
        body: JSON.stringify({ paymentId: checkout.paymentId, outcome }),
      })
      setPaymentResult(result)
      setPaymentDone(true)
      setPaymentMessage(result.message)
      onBooked()
    } catch (error) {
      setPaymentMessage(error.message || 'Demo checkout failed.')
    } finally {
      setPaymentBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(eventObject) => {
      if (eventObject.target === eventObject.currentTarget) onClose()
    }}>
      <section className="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close booking">×</button>
        {registration ? (
          <div className="booking-confirmation">
            <div className="confirmation-mark">✓</div>
            <p className="eyebrow">Reservation received</p>
            <h2 id="booking-title">{event.Name}</h2>
            <p>Your reservation is in Salesforce. {paymentResult
              ? <>Payment status: <strong>{paymentResult.paymentStatus}</strong>; ticket status: <strong>{paymentResult.ticketStatus}</strong>.</>
              : <>Payment and ticket status are still <strong>Pending</strong>; no ticket is confirmed yet.</>}</p>
            <dl className="confirmation-details">
              <div><dt>Reference</dt><dd>{registration.registrationNumber}</dd></div>
              <div><dt>Category</dt><dd>{category}</dd></div>
              <div><dt>Price</dt><dd>{formatPrice(registration.amount)}</dd></div>
            </dl>
            <div className="notice notice-info">The following is a demo checkout only. It does not charge real money.</div>
            {paymentMessage && <p className="notice notice-info" role="status">{paymentMessage}</p>}
            {!paymentDone && (
              <div className="button-row">
                <button className="button button-primary" disabled={paymentBusy} onClick={() => demoCheckout('success')}>{paymentBusy ? 'Processing…' : 'Complete demo checkout'}</button>
                <button className="button button-outline" disabled={paymentBusy} onClick={() => demoCheckout('failure')}>Test failed checkout</button>
              </div>
            )}
            {paymentDone && paymentResult?.ticketStatus !== 'Confirmed' && <p className="notice notice-warning">Your booking is not a confirmed ticket. You can sign in to review your booking.</p>}
            <div className="button-row">
              {authenticated && <a className="button button-primary" href="/my-tickets">View my tickets</a>}
              {!authenticated && <a className="button button-outline" href="/login">Sign in to view bookings</a>}
              <button className="button button-quiet" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <p className="eyebrow">Your next experience</p>
            <h2 id="booking-title">Reserve your place</h2>
            <p className="dialog-event-name">{event.Name}</p>
            <p className="muted">{formatDate(event.Event_Date__c)} · {event.Venue__c || 'Venue not provided'}</p>
            <form className="form-stack" onSubmit={submitBooking}>
              <label htmlFor="booking-name">Full name</label>
              <input id="booking-name" required maxLength="80" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <label htmlFor="booking-email">Email address</label>
              <input id="booking-email" type="email" required maxLength="254" autoComplete="email" value={attendeeEmail} onChange={(e) => setAttendeeEmail(e.target.value)} />
              <label htmlFor="ticket-category">Ticket category</label>
              <select id="ticket-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="General">General · {formatPrice(getPrice(event))}</option>
                <option value="VIP" disabled={event.VIP_Ticket_Price__c == null || (event.VIP_Tickets_Remaining__c != null && Number(event.VIP_Tickets_Remaining__c) <= 0) || (event.VIP_Ticket_Capacity__c != null && Number(event.VIP_Ticket_Capacity__c) <= 0)}>
                  VIP · {formatPrice(event.VIP_Ticket_Price__c)}
                </option>
              </select>
              <p className="form-note">This reservation creates one registration. Quantity is not supported by the current booking API.</p>
              {message && <p className="notice notice-error" role="alert">{message}</p>}
              <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Create reservation'}</button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function DigitalTicket({ ticket }) {
  const token = ticket.ticketToken
  const verificationUrl = token ? `${API_URL}/api/tickets/verify/${token}` : ''
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') !== '1') return undefined
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <article className="ticket">
        <div className="ticket-main-panel">
          <section className="ticket-event-panel">
            <div className="ticket-brand"><span>EPICEVENTZ</span><span className="ticket-kicker">DIGITAL EVENT TICKET</span></div>
            <div className="ticket-event-art" aria-hidden="true"><span>✦</span><small>EVENT ARTWORK NOT PROVIDED</small></div>
            <p className="eyebrow">You’re going to</p>
            <h2>{ticket.eventName}</h2>
            <div className="ticket-event-facts">
              <div><span>Date</span><strong>{formatDate(ticket.eventDate)}</strong></div>
              <div><span>Venue</span><strong>{ticket.venue || 'Not provided'}</strong></div>
              {ticket.attendeeName && <div><span>Attendee</span><strong>{ticket.attendeeName}</strong></div>}
            </div>
          </section>
          <aside className="ticket-stub">
            <span className={`ticket-status ${ticket.ticketStatus.toLowerCase()}`}>{ticket.ticketStatus}</span>
            <div className="ticket-stub-details">
              <div><span>Ticket type</span><strong>{ticket.category}</strong></div>
              <div><span>Ticket / booking reference</span><strong>{ticket.registrationId}</strong></div>
              <div><span>Payment</span><strong>{ticket.paymentStatus}</strong></div>
              <div><span>Amount paid</span><strong>{formatPrice(ticket.amountPaid)}</strong></div>
            </div>
            {ticket.paymentStatus === 'Paid' && ticket.ticketStatus === 'Confirmed' && token ? (
              <div className="ticket-code">
                <QRCodeSVG value={verificationUrl} size={132} level="M" includeMargin title={`Secure verification code for ${ticket.registrationId}`} />
                <span>Secure ticket verification</span>
                <small>Venue scanning is not implemented</small>
              </div>
            ) : (
              <div className="ticket-pending" role="status">
                <strong>{ticket.ticketStatus === 'Confirmed' ? 'Verification code unavailable' : 'Not confirmed yet'}</strong>
                <span>{ticket.ticketStatus === 'Confirmed' ? 'Ticket signing is not configured on the server.' : 'A QR code is issued only after payment and confirmation.'}</span>
              </div>
            )}
          </aside>
        </div>
      </article>
      <div className="ticket-actions">
        <a className="button button-primary" href={`/tickets/${encodeURIComponent(ticket.registrationId)}?print=1`}>Download PDF</a>
        <button className="button button-outline" onClick={() => window.print()}>Print ticket</button>
        <a className="button button-quiet" href="/my-tickets">Back to My Tickets</a>
        <p>To download a PDF, choose “Save as PDF” in the print dialog. Downloading does not create another booking.</p>
      </div>
    </>
  )
}

function App() {
  const path = window.location.pathname
  const isAssistant = path === '/ai-assistant'
  const isLogin = path === '/login'
  const isDashboard = path === '/account' || path === '/dashboard'
  const isHistory = path === '/booking-history'
  const isSpending = path === '/spending'
  const isCancellations = path === '/cancellations'
  const isFeedback = path === '/feedback'
  const isAccount = isDashboard || isHistory || isSpending || isCancellations || isFeedback || path === '/my-tickets' || path === '/tickets' || path.startsWith('/tickets/')
  const eventId = path.startsWith('/events/') ? decodeURIComponent(path.slice('/events/'.length)) : ''
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [bookingEvent, setBookingEvent] = useState(null)
  const [bookingCategory, setBookingCategory] = useState('General')
  const [authenticated, setAuthenticated] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [sessionChecked, setSessionChecked] = useState(false)
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketsError, setTicketsError] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageType, setAuthMessageType] = useState('info')
  const [authBusy, setAuthBusy] = useState(false)
  const authRequestInFlight = useRef(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [assistantText, setAssistantText] = useState('')
  const [assistantMessages, setAssistantMessages] = useState([])
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [cancelRequests, setCancelRequests] = useState([])
  const [cancelReason, setCancelReason] = useState('')
  const [cancelRegistration, setCancelRegistration] = useState('')
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [sessionError, setSessionError] = useState('')

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      const matchesQuery = !query ||
        `${event.Name || ''} ${event.Venue__c || ''}`.toLowerCase().includes(query)
      const matchesLocation = !locationFilter || event.Venue__c === locationFilter
      const matchesDate = !dateFilter || event.Event_Date__c === dateFilter
      return matchesQuery && matchesLocation && matchesDate
    })
  }, [events, search, locationFilter, dateFilter])

  const upcomingTickets = tickets
    .filter(isUpcomingTicket)
    .sort((left, right) => String(left.eventDate).localeCompare(String(right.eventDate)))
  const paidTickets = tickets.filter(isPaidTicket)
  const totalSpent = paidTickets.reduce((total, ticket) => total + Number(ticket.amountPaid || 0), 0)
  const confirmedRefunds = cancelRequests
    .filter((request) => ['completed', 'refunded'].includes(String(request.refundStatus).toLowerCase()))
    .reduce((total, request) => total + Number(request.refundAmount || 0), 0)

  const locations = [...new Set(events.map((item) => item.Venue__c).filter(Boolean))]
  const eventDates = [...new Set(events.map((item) => item.Event_Date__c).filter(Boolean))].sort()

  function openBooking(event, category = 'General') {
    setBookingEvent(event)
    setBookingCategory(category)
  }

  async function loadEvents() {
    setLoading(true)
    setEventsError('')
    try {
      const data = await apiRequest('/api/events')
      setEvents(data.events || [])
    } catch (error) {
      setEventsError(error.message || 'Could not load events.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTickets() {
    setTicketsLoading(true)
    setTicketsError('')
    try {
      const data = await apiRequest('/api/my-tickets')
      setTickets(data.tickets || [])
    } catch (error) {
      setTicketsError(error.message || 'Could not load bookings.')
      if (error.message.toLowerCase().includes('verify your email')) {
        setAuthenticated(false)
        setVerifiedEmail('')
      }
    } finally {
      setTicketsLoading(false)
    }
  }

  async function loadCancellationRequests() {
    try {
      const data = await apiRequest('/api/my-cancellation-requests')
      setCancelRequests(data.requests || [])
    } catch (error) {
      setCancelMessage(error.message || 'Could not load cancellation requests.')
    }
  }

  useEffect(() => {
    const startup = window.setTimeout(() => {
      loadEvents()
      apiRequest('/api/auth/me')
        .then((data) => {
          setAuthenticated(true)
          setVerifiedEmail(data.email)
          setLoginEmail(data.email)
          if (isAccount) {
            loadTickets()
            loadCancellationRequests()
          }
        })
        .catch(() => setAuthenticated(false))
        .finally(() => setSessionChecked(true))
    }, 0)
    return () => window.clearTimeout(startup)
  }, [isAccount])

  useEffect(() => {
    if (resendSeconds <= 0) return undefined
    const timer = window.setTimeout(() => setResendSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  useEffect(() => {
    if (!sessionChecked || !isAccount || authenticated) return
    window.location.replace(`/login?next=${encodeURIComponent(path)}`)
  }, [sessionChecked, isAccount, authenticated, path])

  useEffect(() => {
    if (sessionChecked && isLogin && authenticated) {
      window.location.replace('/account')
    }
  }, [sessionChecked, isLogin, authenticated])

  async function requestOtp(event) {
    event.preventDefault()
    if (authBusy || authRequestInFlight.current || resendSeconds > 0) return
    authRequestInFlight.current = true
    setAuthBusy(true)
    setAuthMessage('')
    setAuthMessageType('info')
    setOtp('')
    setResendSeconds(60)
    try {
      const data = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail.trim() }),
        signal: AbortSignal.timeout(50000),
      })
      setOtpRequested(true)
      setAuthMessage(data.message || 'If this email is registered, a code will be sent.')
    } catch (error) {
      if (error.retryAfter) setResendSeconds(error.retryAfter)
      setAuthMessageType('error')
      setAuthMessage(error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'The request took too long. Please wait for the cooldown, then try again.'
        : error.message || 'Could not request a verification code.')
    } finally {
      authRequestInFlight.current = false
      setAuthBusy(false)
    }
  }

  async function verifyOtp(event) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthMessage('')
    setAuthMessageType('info')
    try {
      const data = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail.trim(), otp: otp.trim() }),
      })
      setAuthenticated(true)
      setVerifiedEmail(data.attendeeEmail || loginEmail.trim())
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')
      window.location.assign(next?.startsWith('/') && !next.startsWith('//') ? next : '/account')
    } catch (error) {
      setAuthMessageType('error')
      setAuthMessage(error.message || 'Verification failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    setSessionError('')
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      setAuthenticated(false)
      setVerifiedEmail('')
      setTickets([])
      window.location.assign('/')
    } catch (error) {
      setSessionError(error.message || 'Could not sign out. Please try again.')
    }
  }

  async function submitCancellation(event) {
    event.preventDefault()
    setCancelBusy(true)
    setCancelMessage('')
    try {
      const data = await apiRequest('/api/cancellation-requests', {
        method: 'POST',
        body: JSON.stringify({ registrationId: cancelRegistration, reason: cancelReason.trim() }),
      })
      setCancelMessage(`Cancellation request ${data.requestNumber} submitted for organizer review.`)
      setCancelReason('')
      setCancelRegistration('')
      await loadCancellationRequests()
    } catch (error) {
      setCancelMessage(error.message || 'Could not submit cancellation request.')
    } finally {
      setCancelBusy(false)
    }
  }

  async function askAssistant(question = assistantText) {
    const message = question.trim()
    if (!message || assistantBusy) return
    setAssistantText('')
    setAssistantError('')
    setAssistantMessages((items) => [...items, { role: 'user', text: message }])
    setAssistantBusy(true)
    try {
      if (/\b(my tickets?|this tickets?|digital tickets?|my bookings?|my reservations?|booking reference|qr(?: code)?|download.*ticket|find (?:my|the|this|digital).*ticket|where.*ticket|ticket again|did my booking|booking succeed|show.*my tickets?)\b/i.test(message)) {
        if (!authenticated) {
          setAssistantMessages((items) => [...items, {
            role: 'assistant',
            text: 'Your booking details are private. Sign in with the email used for the reservation, then open My Tickets to view your booking and ticket.',
            link: { href: `/login?next=${encodeURIComponent('/my-tickets')}`, label: 'Sign in to My Tickets' },
          }])
        } else {
          const data = await apiRequest('/api/my-tickets')
          setAssistantMessages((items) => [...items, {
            role: 'assistant',
            text: data.tickets?.length
              ? 'Here are the bookings linked to your signed-in account. Confirmed tickets can be viewed and printed; pending bookings are not valid entry tickets.'
              : 'I couldn’t find any bookings linked to your account. If you just made a reservation, try refreshing or check that you signed in with the same email.',
            link: { href: '/my-tickets', label: 'Open My Tickets' },
            tickets: data.tickets || [],
          }])
        }
        return
      }

      const context = assistantMessages
        .filter((item) => item.role === 'user')
        .slice(-3)
        .map((item) => item.text)
      const data = await apiRequest('/api/assistant/recommendations', {
        method: 'POST',
        body: JSON.stringify({ message, context }),
      })
      setAssistantMessages((items) => [...items, {
        role: 'assistant',
        text: data.message,
        events: data.recommendations || [],
        intent: data.intent,
        followUp: data.followUp,
      }])
    } catch {
      setAssistantError('I’m having trouble loading event information right now. Please try again in a moment.')
    } finally {
      setAssistantBusy(false)
    }
  }

  function startNewConversation() {
    setAssistantMessages([])
    setAssistantError('')
    setAssistantText('')
  }

  const event = eventId ? events.find((item) => item.Id === eventId) : null
  const ticketRef = path.startsWith('/tickets/') ? decodeURIComponent(path.slice('/tickets/'.length)) : ''
  const selectedTicket = tickets.find((ticket) => ticket.registrationId === ticketRef)
  const content = (() => {
    if (isLogin) {
      return (
        <main className="auth-layout">
          <section className="auth-card">
            <Logo />
            <div className="auth-intro"><span className="eyebrow">Your experiences, all in one place</span><h1>Welcome back.</h1><p>Sign in to access your bookings and digital tickets.</p></div>
            {!otpRequested ? (
              <form className="form-stack" onSubmit={requestOtp}>
                <label htmlFor="login-email">Email address</label>
                <input id="login-email" type="email" autoComplete="email" required maxLength="254" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" />
                <button className="button button-primary button-wide" disabled={authBusy || resendSeconds > 0}>{authBusy ? 'Sending code…' : resendSeconds > 0 ? `Try again in ${resendSeconds}s` : 'Send verification code'}</button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={verifyOtp}>
                <p className="muted">Enter the six-digit code sent to <strong>{loginEmail}</strong>. If this email is registered, you’ll receive a message shortly.</p>
                <label htmlFor="verification-code">Verification code</label>
                <input id="verification-code" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
                <button className="button button-primary button-wide" disabled={authBusy}>{authBusy ? 'Verifying…' : 'Verify and sign in'}</button>
                <button className="button button-quiet" type="button" disabled={authBusy || resendSeconds > 0} onClick={requestOtp}>
                  {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
                </button>
              </form>
            )}
            {authMessage && <p className={`notice ${authMessageType === 'error' ? 'notice-error' : 'notice-info'}`} role={authMessageType === 'error' ? 'alert' : 'status'}>{authMessage}</p>}
            <p className="auth-register">New to EpicEventz? <a href="/#events">Reserve your first event</a> to create an attendee profile, then sign in with that email.</p>
            <a className="back-link" href="/">← Back to home</a>
          </section>
          <aside className="auth-aside"><span className="eyebrow">Find your next moment</span><h2>Good times are better shared.</h2><p>Discover something new, then keep every booking close at hand.</p><div className="aside-decoration" aria-hidden="true"><span>✦</span><span>◌</span><span>✳</span></div></aside>
        </main>
      )
    }
    if (isAssistant) {
      return (
        <main className="assistant-page">
          <div className="assistant-heading"><span className="assistant-icon">✦</span><p className="eyebrow">EpicEventz event assistant</p><h1>Tell us what you’re in the mood for.</h1><p>Describe a location, budget, or ticket preference. I’ll search the event listings currently available.</p><span className="mode-note">Rule-based search · recommendations use live event data</span></div>
          <div className="assistant-toolbar">
            <span>Current conversation</span>
            <button className="button button-quiet button-small" onClick={startNewConversation} disabled={!assistantMessages.length && !assistantError}>Start new conversation</button>
          </div>
          <div className="assistant-chat" aria-live="polite">
            {!assistantMessages.length && <div className="assistant-welcome"><span className="assistant-icon">✦</span><p><strong>Welcome to EpicEventz AI!</strong><br />Looking for a concert, workshop, conference, or weekend experience? Tell me what you have in mind, and I’ll help you discover suitable events and choose the right ticket.</p></div>}
            {assistantMessages.map((item, index) => (
              <div className={`chat-message chat-${item.role}`} key={`${item.role}-${index}`}>
                <p>{item.text}</p>
                {item.link && <a className="button button-outline assistant-inline-link" href={item.link.href}>{item.link.label} ↗</a>}
                {item.tickets?.length > 0 && <div className="assistant-private-tickets">{item.tickets.map((ticket) => (
                  <article className="assistant-private-ticket" key={ticket.registrationId}>
                    <div><strong>{ticket.eventName}</strong><span>{formatDate(ticket.eventDate)} · {ticket.category}</span><small>Payment: {ticket.paymentStatus} · Ticket: {ticket.ticketStatus}</small></div>
                    {ticket.ticketStatus === 'Confirmed'
                      ? <a className="button button-outline button-small" href={`/tickets/${encodeURIComponent(ticket.registrationId)}`}>View ticket</a>
                      : <span className="ticket-status-text">Pending</span>}
                  </article>
                ))}</div>}
                {item.intent === 'comparison' && item.events?.length > 0 && (
                  <div className="comparison-scroll"><table className="comparison-table"><thead><tr><th>Feature</th>{item.events.slice(0, 3).map((eventItem) => <th key={eventItem.Id}>{eventItem.Name}</th>)}</tr></thead><tbody>
                    <tr><th>Date</th>{item.events.slice(0, 3).map((eventItem) => <td key={eventItem.Id}>{formatDate(eventItem.Event_Date__c)}</td>)}</tr>
                    <tr><th>Venue</th>{item.events.slice(0, 3).map((eventItem) => <td key={eventItem.Id}>{eventItem.Venue__c || 'Not provided'}</td>)}</tr>
                    <tr><th>Starting price</th>{item.events.slice(0, 3).map((eventItem) => <td key={eventItem.Id}>{formatPrice(eventItem.recommendedPrice)}</td>)}</tr>
                    <tr><th>Ticket category</th>{item.events.slice(0, 3).map((eventItem) => <td key={eventItem.Id}>{eventItem.recommendedCategory || 'Not available'}</td>)}</tr>
                  </tbody></table></div>
                )}
                {item.events?.length > 0 && <div className="recommendation-grid">{item.events.map((recommended) => <EventCard key={recommended.Id} event={recommended} onBook={openBooking} showCategories={item.intent === 'ticket-categories'} compact />)}</div>}
                {item.followUp && <p className="assistant-follow-up">{item.followUp}</p>}
              </div>
            ))}
            {assistantBusy && <div className="assistant-loading" role="status"><span /><span /><span /> Searching real event listings…</div>}
            {assistantError && <div className="notice notice-error" role="alert">{assistantError} <button className="text-button" onClick={() => askAssistant(assistantMessages.filter((item) => item.role === 'user').at(-1)?.text)}>Retry</button></div>}
          </div>
          {!assistantMessages.length && <div className="suggestions">{SUGGESTIONS.map((suggestion) => <button key={suggestion} onClick={() => askAssistant(suggestion)}>{suggestion}<span>↗</span></button>)}</div>}
          <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); askAssistant() }}>
            <label className="visually-hidden" htmlFor="assistant-question">Ask for event recommendations</label>
            <input id="assistant-question" value={assistantText} maxLength="500" onChange={(e) => setAssistantText(e.target.value)} placeholder="Describe the event you’re looking for…" />
            <button className="button button-primary" disabled={assistantBusy || !assistantText.trim()} aria-label="Send message">Send <span aria-hidden="true">↑</span></button>
          </form>
          <p className="assistant-disclaimer">I use a rule-based search of live event data. Event categories, artwork, taxes, and some details aren’t supplied in the current listings, so I won’t guess them. No AI model is configured.</p>
        </main>
      )
    }
    if (isAccount) {
      if (!sessionChecked || !authenticated) return <main className="page-shell"><div className="state-card"><div className="spinner" /><p>Checking your secure session…</p></div></main>
      if (path.startsWith('/tickets/') && ticketsLoading) return <main className="page-shell"><div className="state-card"><div className="spinner" /><p>Loading your ticket…</p></div></main>
      if (path.startsWith('/tickets/') && selectedTicket) return <main className="page-shell"><a className="back-link" href="/my-tickets">← Back to My Tickets</a><DigitalTicket ticket={selectedTicket} /></main>
      if (path.startsWith('/tickets/')) return <main className="page-shell"><div className="state-card"><h1>Ticket unavailable</h1><p>This booking could not be found in your account.</p><a className="button button-primary" href="/my-tickets">Back to My Tickets</a></div></main>
      if (isDashboard) {
        const nextTicket = upcomingTickets[0]
        return (
          <main className="page-shell dashboard-page">
            <aside className="dashboard-sidebar" aria-label="Attendee navigation">
              <div className="sidebar-brand"><Logo /></div>
              <p className="sidebar-label">MENU</p>
              <nav className="sidebar-nav">
                <a className="active" href="/account"><span>⌂</span>Dashboard</a>
                <a href="/#events"><span>⌕</span>Explore events</a>
                <a href="/my-tickets"><span>▣</span>My tickets</a>
                <a href="/booking-history"><span>◷</span>Booking history</a>
                <a href="/spending"><span>◈</span>My spending</a>
                <a href="/cancellations"><span>↺</span>Cancellation requests</a>
                <a href="/feedback"><span>☆</span>Feedback</a>
                <a href="/ai-assistant"><span>✦</span>AI assistant</a>
              </nav>
              <div className="sidebar-account"><span className="avatar">{verifiedEmail.slice(0, 1).toUpperCase()}</span><span><strong>Attendee</strong><small>{verifiedEmail}</small></span></div>
            </aside>
            <section className="dashboard-content">
              <div className="dashboard-topline"><span>{CURRENT_DATE_LABEL}</span><a className="dashboard-notifications" href="/cancellations" aria-label="View cancellation requests">♧</a></div>
              <header className="dashboard-welcome"><div><p className="eyebrow">YOUR EVENT SPACE</p><h1>Welcome back<span className="welcome-dot">.</span></h1><p>Here’s what’s happening with your events.</p></div><a className="button button-primary" href="/#events">＋ Explore events</a></header>
              {ticketsError && <div className="notice notice-error" role="alert">{ticketsError}<button className="text-button" onClick={loadTickets}>Retry</button></div>}
              {cancelMessage && <div className="notice notice-error" role="alert">{cancelMessage}</div>}
              <div className="dashboard-stats">
                <article className="stat-card"><span className="stat-icon violet">▣</span><div><span>Upcoming events</span><strong>{ticketsLoading ? '—' : upcomingTickets.length}</strong><small>Confirmed tickets</small></div><span className="stat-trend">↗</span></article>
                <article className="stat-card"><span className="stat-icon blue">⌑</span><div><span>Tickets booked</span><strong>{ticketsLoading ? '—' : tickets.filter((ticket) => ticket.ticketStatus === 'Confirmed').length}</strong><small>Confirmed tickets</small></div><span className="stat-trend">↗</span></article>
                <article className="stat-card"><span className="stat-icon pink">₹</span><div><span>Total spent</span><strong>{ticketsLoading ? '—' : formatPrice(totalSpent)}</strong><small>Paid bookings only</small></div><span className="stat-trend">↗</span></article>
                <article className="stat-card"><span className="stat-icon amber">☆</span><div><span>Feedback given</span><strong>—</strong><small>Not available yet</small></div><span className="stat-trend">↗</span></article>
              </div>
              <div className="dashboard-columns">
                <section className="dashboard-panel upcoming-panel">
                  <div className="dashboard-panel-heading"><div><p className="eyebrow">DON’T MISS OUT</p><h2>Upcoming events</h2></div><a href="/my-tickets">View all <span>↗</span></a></div>
                  {ticketsLoading ? <div className="skeleton-ticket" /> : upcomingTickets.length ? <div className="dashboard-event-list">{upcomingTickets.slice(0, 3).map((ticket) => (
                    <article className="dashboard-event-row" key={ticket.registrationId}>
                      <div className="dashboard-event-art"><span>✦</span></div><div className="dashboard-event-info"><strong>{ticket.eventName}</strong><span>{formatDate(ticket.eventDate)} · {ticket.venue || 'Venue not provided'}</span><small>{ticket.category} · {ticket.paymentStatus}</small></div><a href={`/tickets/${encodeURIComponent(ticket.registrationId)}`} aria-label={`View ticket for ${ticket.eventName}`}>↗</a>
                    </article>
                  ))}</div> : <div className="dashboard-empty"><span>✦</span><strong>No upcoming events</strong><p>Once you have a confirmed ticket, your next event will appear here.</p><a className="button button-outline button-small" href="/#events">Browse events</a></div>}
                </section>
                <section className="dashboard-panel ticket-preview-panel">
                  <div className="dashboard-panel-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Next ticket</h2></div><span className="ticket-status-pill">{nextTicket ? 'CONFIRMED' : '—'}</span></div>
                  {nextTicket ? <div className="mini-ticket"><div className="mini-ticket-cover"><span>EPICEVENTZ</span><strong>{nextTicket.eventName}</strong><small>{formatDate(nextTicket.eventDate)}</small></div><div className="mini-ticket-details"><span>{nextTicket.venue || 'Venue not provided'}</span><strong>{nextTicket.category}</strong><a href={`/tickets/${encodeURIComponent(nextTicket.registrationId)}`}>Open digital ticket →</a></div></div> : <div className="ticket-preview-empty"><span>▣</span><p>Your next confirmed ticket will be ready here.</p></div>}
                  <div className="quick-actions"><a href="/my-tickets">All tickets <span>→</span></a><a href="/spending">Spending summary <span>→</span></a></div>
                </section>
              </div>
              <section className="dashboard-panel recent-panel">
                <div className="dashboard-panel-heading"><div><p className="eyebrow">YOUR LATEST ACTIVITY</p><h2>Recent bookings</h2></div><a href="/booking-history">Booking history <span>↗</span></a></div>
                {ticketsLoading ? <div className="skeleton-ticket" /> : tickets.length ? <div className="recent-table"><div className="recent-table-head"><span>EVENT</span><span>DATE</span><span>PAYMENT</span><span>STATUS</span></div>{tickets.slice(0, 4).map((ticket) => <div className="recent-table-row" key={ticket.registrationId}><strong>{ticket.eventName}<small>{ticket.registrationId}</small></strong><span>{formatDate(ticket.eventDate)}</span><span>{ticket.paymentStatus === 'Paid' ? formatPrice(ticket.amountPaid) : ticket.paymentStatus}</span><span className={`status-chip ${ticket.ticketStatus.toLowerCase()}`}>{ticket.ticketStatus}</span></div>)}</div> : <div className="dashboard-empty compact-empty"><p>Recent reservations will show here.</p><a href="/#events">Explore events →</a></div>}
              </section>
              <div className="dashboard-quick-links"><a href="/ai-assistant"><span>✦</span><div><strong>Need a recommendation?</strong><small>Ask the event assistant to search real listings</small></div><b>→</b></a><a href="/cancellations"><span>↺</span><div><strong>Manage a cancellation</strong><small>Track organizer review and refund progress</small></div><b>→</b></a></div>
            </section>
          </main>
        )
      }
      if (isFeedback) return <main className="page-shell"><section className="state-card capability-card"><span className="state-icon">☆</span><p className="eyebrow">ATTENDEE FEEDBACK</p><h1>Feedback isn’t connected yet</h1><p>The current Salesforce attendee API has no feedback endpoint or feedback records. No rating or submission will be shown as saved until that integration is available.</p><a className="button button-primary" href="/account">Back to dashboard</a></section></main>
      if (isHistory || isSpending) return (
        <main className="page-shell account-page">
          <div className="account-heading"><div><p className="eyebrow">{isSpending ? 'PAYMENTS & REFUNDS' : 'YOUR RESERVATIONS'}</p><h1>{isSpending ? 'My spending' : 'Booking history'}</h1><p>Records shown are loaded from your Salesforce attendee account.</p></div><a className="button button-outline" href="/#events">Explore events</a></div>
          {ticketsError && <div className="notice notice-error" role="alert">{ticketsError}<button className="text-button" onClick={loadTickets}>Retry</button></div>}
          {isSpending && <div className="spending-summary"><article><span>Total amount paid</span><strong>{formatPrice(totalSpent)}</strong><small>Only bookings marked Paid</small></article><article><span>Confirmed refunds</span><strong>{formatPrice(confirmedRefunds)}</strong><small>Only completed or refunded requests</small></article><article><span>Net spending</span><strong>{formatPrice(Math.max(0, totalSpent - confirmedRefunds))}</strong><small>Paid amount less confirmed refunds</small></article></div>}
          <section className="account-section"><div className="section-title"><div><p className="eyebrow">{isSpending ? 'PAYMENT RECORDS' : 'ALL BOOKINGS'}</p><h2>{isSpending ? 'Payment activity' : 'Booking activity'}</h2></div><button className="button button-quiet" onClick={loadTickets} disabled={ticketsLoading}>{ticketsLoading ? 'Refreshing…' : 'Refresh'}</button></div>
            {ticketsLoading ? <div className="skeleton-ticket" /> : tickets.length ? <div className="ticket-list">{tickets.map((ticket) => <div className="booking-row" key={ticket.registrationId}><div className="booking-event-mark">✦</div><div className="booking-row-main"><h3>{ticket.eventName}</h3><p>{formatDate(ticket.eventDate)} · {ticket.venue || 'Venue not provided'}</p><div className="booking-badges"><span>{ticket.registrationId}</span><span>{ticket.category}</span><span>{ticket.paymentStatus}</span><span>{ticket.ticketStatus}</span></div></div>{isPaidTicket(ticket) && <strong className="booking-amount">{formatPrice(ticket.amountPaid)}</strong>}<a className="button button-outline button-small" href={`/tickets/${encodeURIComponent(ticket.registrationId)}`}>View record</a></div>)}</div> : <div className="state-card"><h3>No booking history</h3><p>Bookings made with this account will appear here.</p><a className="button button-primary" href="/#events">Explore events</a></div>}
          </section>
          {isSpending && <section className="account-section"><div className="section-title"><div><p className="eyebrow">REFUND STATUS</p><h2>Cancellation refunds</h2></div></div>{cancelMessage && <div className="notice notice-error" role="alert">{cancelMessage}</div>}{cancelRequests.length ? <ul className="request-list">{cancelRequests.map((request) => <li key={request.requestNumber}><strong>{request.eventName}</strong><span>{request.refundStatus} · {formatPrice(request.refundAmount)}</span></li>)}</ul> : <p className="muted">No cancellation or refund records are available.</p>}</section>}
        </main>
      )
      if (isCancellations) return (
        <main className="page-shell account-page">
          <div className="account-heading"><div><p className="eyebrow">ORGANIZER-REVIEWED REQUESTS</p><h1>Cancellation requests</h1><p>Requests are subject to the event organizer’s review and policy.</p></div><a className="button button-outline" href="/my-tickets">View tickets</a></div>
          {ticketsError && <div className="notice notice-error" role="alert">{ticketsError}<button className="text-button" onClick={loadTickets}>Retry</button></div>}
          <section className="account-section"><p className="notice notice-warning">Submitting a request does not cancel a ticket or confirm a refund. Your ticket remains subject to its current status until the organizer finalizes the request.</p>{tickets.filter((ticket) => ticket.paymentStatus === 'Paid' && ticket.ticketStatus === 'Confirmed').length ? <form className="cancellation-form form-stack" onSubmit={submitCancellation}><label htmlFor="cancel-registration">Eligible confirmed ticket</label><select id="cancel-registration" required value={cancelRegistration} onChange={(e) => setCancelRegistration(e.target.value)}><option value="">Choose a booking</option>{tickets.filter((ticket) => ticket.paymentStatus === 'Paid' && ticket.ticketStatus === 'Confirmed').map((ticket) => <option value={ticket.registrationId} key={ticket.registrationId}>{ticket.eventName} · {ticket.registrationId}</option>)}</select><label htmlFor="cancel-reason">Reason for cancellation</label><textarea id="cancel-reason" required maxLength="1000" rows="4" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Tell the organizer why you need to cancel…" /><p className="form-note">Cancellation policy details are not supplied by the current event API. Please check with the organizer before submitting.</p><button className="button button-primary" disabled={cancelBusy}>{cancelBusy ? 'Submitting request…' : 'Submit cancellation request'}</button></form> : <p className="muted">Only paid and confirmed tickets are currently eligible to request cancellation.</p>}</section>
          <section className="account-section"><div className="section-title"><div><p className="eyebrow">REQUEST TRACKER</p><h2>Your requests</h2></div><button className="button button-quiet" onClick={loadCancellationRequests}>Refresh</button></div>{cancelMessage && <p className="notice notice-info" role="status">{cancelMessage}</p>}{cancelRequests.length ? <ul className="request-list">{cancelRequests.map((request) => <li key={request.requestNumber}><strong>{request.eventName}<small>{request.requestNumber} · {request.reason}</small></strong><span>{request.requestStatus} · Refund {request.refundStatus} ({formatPrice(request.refundAmount)})</span></li>)}</ul> : <p className="muted">No cancellation requests have been submitted.</p>}</section>
        </main>
      )
      return (
        <main className="page-shell account-page">
          <div className="account-heading"><div><p className="eyebrow">Your EpicEventz</p><h1>{path === '/my-tickets' ? 'My tickets' : 'Your account'}</h1><p>Signed in as {verifiedEmail}</p></div><a className="button button-outline" href="/#events">Explore events</a></div>
          {ticketsError && <div className="notice notice-error" role="alert">{ticketsError}<button className="text-button" onClick={loadTickets}>Retry</button></div>}
          <section className="account-section" id="bookings"><div className="section-title"><div><p className="eyebrow">Reservations & tickets</p><h2>My bookings</h2></div><button className="button button-quiet" onClick={loadTickets} disabled={ticketsLoading}>{ticketsLoading ? 'Refreshing…' : 'Refresh'}</button></div>
            {ticketsLoading ? <div className="skeleton-ticket" /> : tickets.length ? <div className="ticket-list">{tickets.map((ticket) => (
              <div className="booking-row" key={ticket.registrationId}>
                <div className="booking-event-mark">✦</div>
                <div className="booking-row-main"><h3>{ticket.eventName}</h3><p>{formatDate(ticket.eventDate)} · {ticket.venue || 'Venue not provided'}</p><div className="booking-badges"><span>{ticket.category}</span><span>{ticket.paymentStatus}</span><span>{ticket.ticketStatus}</span></div></div>
                <a className="button button-outline button-small" href={`/tickets/${encodeURIComponent(ticket.registrationId)}`}>View ticket</a>
                {ticket.ticketStatus === 'Confirmed' && <a className="button button-quiet button-small" href={`/tickets/${encodeURIComponent(ticket.registrationId)}?print=1`}>Download</a>}
              </div>
            ))}</div> : <div className="state-card"><span className="state-icon">⌑</span><h3>No bookings yet</h3><p>Your reservations and digital tickets will appear here.</p><a className="button button-primary" href="/#events">Explore events</a></div>}
          </section>
          <section className="account-section"><div className="section-title"><div><p className="eyebrow">Need to change plans?</p><h2>Cancellation requests</h2></div></div>
            {tickets.filter((ticket) => ticket.paymentStatus === 'Paid' && ticket.ticketStatus === 'Confirmed').length > 0 ? <form className="cancellation-form form-stack" onSubmit={submitCancellation}>
              <label htmlFor="cancel-registration">Confirmed ticket</label><select id="cancel-registration" required value={cancelRegistration} onChange={(e) => setCancelRegistration(e.target.value)}><option value="">Choose a booking</option>{tickets.filter((ticket) => ticket.paymentStatus === 'Paid' && ticket.ticketStatus === 'Confirmed').map((ticket) => <option value={ticket.registrationId} key={ticket.registrationId}>{ticket.eventName} · {ticket.registrationId}</option>)}</select>
              <label htmlFor="cancel-reason">Reason</label><textarea id="cancel-reason" required maxLength="1000" rows="3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <button className="button button-outline" disabled={cancelBusy}>{cancelBusy ? 'Submitting…' : 'Request cancellation'}</button>
            </form> : <p className="muted">Only paid and confirmed tickets can request cancellation.</p>}
            {cancelMessage && <p className="notice notice-info" role="status">{cancelMessage}</p>}
            {cancelRequests.length > 0 && <ul className="request-list">{cancelRequests.map((request) => <li key={request.requestNumber}><strong>{request.eventName}</strong><span>{request.requestStatus} · Refund {request.refundStatus}</span></li>)}</ul>}
          </section>
        </main>
      )
    }
    if (eventId) {
      if (loading) return <main className="page-shell"><div className="state-card"><div className="spinner" /><p>Loading event details…</p></div></main>
      if (!event) return <main className="page-shell"><div className="state-card"><h1>Event unavailable</h1><p>This event may have ended or is no longer listed.</p><a href="/" className="button button-primary">Back to events</a></div></main>
      const generalRemaining = event.General_Tickets_Remaining__c
      return <main className="page-shell event-detail">
        <a className="back-link" href="/#events">← Explore events</a>
        <div className="detail-art event-art"><span className="art-orbit art-orbit-one" /><span className="art-orbit art-orbit-two" /><span className="art-brand">EPICEVENTZ</span><span className="art-caption">A moment worth remembering</span></div>
        <div className="detail-content"><p className="eyebrow">Event details</p><h1>{event.Name}</h1><p className="detail-venue">{formatDate(event.Event_Date__c)} · {event.Venue__c || 'Venue not provided'}</p>
          <div className="detail-info"><div><span>General admission</span><strong>{formatPrice(getPrice(event))}</strong></div><div><span>VIP</span><strong>{formatPrice(event.VIP_Ticket_Price__c)}</strong></div><div><span>General availability</span><strong>{generalRemaining == null ? 'Not provided' : Number(generalRemaining) <= 0 ? 'Sold out' : `${generalRemaining} remaining`}</strong></div></div>
          <p className="muted">Description, event category, and organizer details are not included in the event data currently supplied by Salesforce.</p>
          <button className="button button-primary" onClick={() => openBooking(event)} disabled={generalRemaining != null && Number(generalRemaining) <= 0}>Book tickets</button>
        </div>
        <section className="related-events"><div className="section-title"><div><p className="eyebrow">Keep exploring</p><h2>More events</h2></div></div><div className="event-grid">{events.filter((item) => item.Id !== event.Id).slice(0, 3).map((item) => <EventCard key={item.Id} event={item} onBook={openBooking} />)}</div></section>
      </main>
    }
    return (
      <main>
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow">YOUR NEXT EXPERIENCE STARTS HERE</p><h1>Discover experiences <span>worth remembering.</span></h1><p className="hero-description">Find events that bring people together. Explore the listings and reserve your place for what’s next.</p>
            <form className="event-search" onSubmit={(e) => { e.preventDefault(); document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' }) }}>
              <label className="visually-hidden" htmlFor="event-search">Search events or venues</label><span aria-hidden="true">⌕</span><input id="event-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events or venues" /><button className="button button-primary">Search events</button>
              <label className="visually-hidden" htmlFor="event-location">Filter by venue</label><select id="event-location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select>
              <label className="visually-hidden" htmlFor="event-date">Filter by event date</label><select id="event-date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}><option value="">Any date</option>{eventDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select>
            </form>
            <div className="hero-links"><a className="button button-outline" href="/ai-assistant">✦ Find events with AI</a><span>Real listings · Secure reservations</span></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="hero-art-orbit orbit-large" /><div className="hero-art-orbit orbit-small" /><div className="hero-art-center">E<span>✦</span></div><div className="hero-art-label">GO WHERE<br />THE MOMENT IS</div></div>
        </section>
        <section className="events-section" id="events"><div className="section-title"><div><p className="eyebrow">Find your next plan</p><h2>Events worth showing up for</h2><p className="section-subtitle">Listings and prices come directly from our event system.</p></div><a className="text-link" href="/ai-assistant">Ask the assistant <span>↗</span></a></div>
          <EventCollection events={visibleEvents} loading={loading} error={eventsError} onRetry={loadEvents} onBook={openBooking} />
        </section>
        <section className="assistant-banner"><div className="banner-icon">✦</div><div><p className="eyebrow">A little help finding the right plan</p><h2>Not sure what to choose?</h2><p>Tell our event assistant what you’re looking for and get matches from the current listings.</p></div><a className="button button-primary" href="/ai-assistant">Meet the assistant <span>→</span></a></section>
      </main>
    )
  })()

  return (
    <div className="app-shell">
      {!isLogin && <Header authenticated={authenticated} onSignOut={signOut} error={sessionError} />}
      {content}
      {!isLogin && <footer className="site-footer"><Logo /><span>Find your people. Find your moment.</span><a href="/ai-assistant">Event assistant</a><small>© {COPYRIGHT_YEAR} EpicEventz</small></footer>}
      {bookingEvent && <BookingDialog event={bookingEvent} initialCategory={bookingCategory} onClose={() => setBookingEvent(null)} authenticated={authenticated} email={verifiedEmail} onBooked={() => { if (authenticated) loadTickets() }} />}
      {isLogin && authenticated && <div className="signed-in-redirect" role="status">You’re already signed in. <a href="/account">Go to your account</a></div>}
    </div>
  )
}

export default App
