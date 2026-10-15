import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL
  || (['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `http://${window.location.hostname}:4000`
    : `${window.location.origin}/api`);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [partnerId, setPartnerId] = useState(null);
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [view, setView] = useState('chat');
  const [profile, setProfile] = useState({ name: '', interests: '', location: '', photo: '' });
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({ interest: '', location: '' });
  const socketRef = useRef(null);

  useEffect(() => {
    if (token) {
      axios.get(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { setUser(r.data); setProfile({ name: r.data.name || '', interests: (r.data.interests || []).join(', '), location: r.data.location || '', photo: r.data.photo || '' }); })
        .catch(() => { localStorage.removeItem('token'); setToken(null); });
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.on('waiting', () => setStatus("En attente d'un partenaire..."));
    socket.on('matched', ({ roomId, partnerId }) => { setStatus('Connecté'); setMessages([]); socket.currentRoom = roomId; setPartnerId(partnerId); });
    socket.on('webrtc-offer', async ({ offer }) => {
      if (!pcRef.current) createPeer(false);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('webrtc-answer', { roomId: socket.currentRoom, answer });
    });
    socket.on('webrtc-answer', async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    });
    socket.on('webrtc-ice', async ({ candidate }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
    });
    socket.on('hangup', () => { if (pcRef.current) { pcRef.current.close(); pcRef.current = null; } });
    socket.on('message', (m) => setMessages(prev => [...prev, m]));
    return () => socket.disconnect();
  }, [token]);

  async function submitAuth(e) {
    e.preventDefault();
    const url = authMode === 'login' ? '/auth/login' : '/auth/register';
    const res = await axios.post(`${API}${url}`, form);
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }

  function findRandom() {
    socketRef.current?.emit('find-random');
  }

  function send() {
    if (!input.trim() || !socketRef.current?.currentRoom) return;
    socketRef.current.emit('message', { roomId: socketRef.current.currentRoom, content: input });
    setInput('');
  }

  function createPeer(initiator) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit('webrtc-ice', { roomId: socketRef.current.currentRoom, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      if (initiator) {
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          socketRef.current.emit('webrtc-offer', { roomId: socketRef.current.currentRoom, offer });
        });
      }
    });
    return pc;
  }

  function startCall() {
    createPeer(true);
  }

  function hangup() {
    socketRef.current?.emit('hangup', { roomId: socketRef.current.currentRoom });
    pcRef.current?.close();
    pcRef.current = null;
  }

  async function reportPartner() {
    const reason = prompt('Raison du signalement ?');
    if (!reason || !partnerId) return;
    await axios.post(`${API}/reports`, { target: partnerId, reason }, { headers: { Authorization: `Bearer ${token}` } });
    alert('Signalement envoyé');
  }

  async function saveProfile(e) {
    e.preventDefault();
    const payload = { name: profile.name, interests: profile.interests.split(',').map(s => s.trim()).filter(Boolean), location: profile.location, photo: profile.photo };
    const res = await axios.put(`${API}/users/me`, payload, { headers: { Authorization: `Bearer ${token}` } });
    setUser(res.data);
    alert('Profil mis à jour');
  }

  async function searchUsers() {
    const params = new URLSearchParams();
    if (filter.interest) params.set('interest', filter.interest);
    if (filter.location) params.set('location', filter.location);
    const res = await axios.get(`${API}/users?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    setUsers(res.data);
  }

  if (!token) {
    return (
      <div style={{maxWidth:400,margin:'4rem auto',fontFamily:'sans-serif'}}>
        <h2>{authMode === 'login' ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={submitAuth} style={{display:'flex',flexDirection:'column',gap:8}}>
          {authMode === 'register' && <input placeholder="Nom" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>}
          <input placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          <input placeholder="Mot de passe" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
          <button type="submit">{authMode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        </form>
        <button onClick={()=>setAuthMode(authMode==='login'?'register':'login')} style={{marginTop:8}}>
          {authMode==='login' ? 'Créer un compte' : "J'ai déjà un compte"}
        </button>
      </div>
    );
  }

  return (
    <div style={{maxWidth:700,margin:'2rem auto',fontFamily:'sans-serif'}}>
      <nav style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={()=>setView('chat')}>Chat</button>
        <button onClick={()=>setView('profile')}>Profil</button>
        <button onClick={()=>setView('search')}>Recherche</button>
      </nav>

      {view === 'chat' && (
        <>
          <h2>Bonjour {user?.name || user?.email}</h2>
          <p>{status}</p>
          <button onClick={findRandom}>Trouver un chat aléatoire</button>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button onClick={startCall} disabled={!partnerId}>Démarrer A/V</button>
            <button onClick={hangup} disabled={!partnerId}>Raccrocher</button>
            <button onClick={reportPartner} disabled={!partnerId}>Signaler</button>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{width:'48%',background:'#000'}}></video>
            <video ref={remoteVideoRef} autoPlay playsInline style={{width:'48%',background:'#000'}}></video>
          </div>
          <div style={{border:'1px solid #ccc',height:200,overflow:'auto',padding:8,marginTop:8}}>
            {messages.map((m,i)=>(<div key={i}><b>{m.from}</b>: {m.content}</div>))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} style={{flex:1}} placeholder="Message..."/>
            <button onClick={send}>Envoyer</button>
          </div>
        </>
      )}

      {view === 'profile' && (
        <form onSubmit={saveProfile} style={{display:'flex',flexDirection:'column',gap:8,maxWidth:400}}>
          <h2>Profil</h2>
          <input placeholder="Nom" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/>
          <input placeholder="Intérêts (séparés par virgule)" value={profile.interests} onChange={e=>setProfile({...profile,interests:e.target.value})}/>
          <input placeholder="Localisation" value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})}/>
          <input placeholder="URL photo" value={profile.photo} onChange={e=>setProfile({...profile,photo:e.target.value})}/>
          <button type="submit">Enregistrer</button>
        </form>
      )}

      {view === 'search' && (
        <div>
          <h2>Recherche utilisateurs</h2>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input placeholder="Intérêt" value={filter.interest} onChange={e=>setFilter({...filter,interest:e.target.value})}/>
            <input placeholder="Localisation" value={filter.location} onChange={e=>setFilter({...filter,location:e.target.value})}/>
            <button onClick={searchUsers}>Filtrer</button>
          </div>
          <ul>
            {users.map(u => (
              <li key={u.id}>{u.name || u.email} — { (u.interests||[]).join(', ') } {u.location ? `(${u.location})` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}