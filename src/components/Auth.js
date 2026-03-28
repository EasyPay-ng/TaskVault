import React, { useState } from 'react';
import { auth } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        // Login Logic
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in successfully!");
      } else {
        // Sign Up Logic
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Set the username in the profile
        await updateProfile(userCredential.user, { displayName: username });
        console.log("Registered successfully!");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-primary px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Task<span className="text-brand-secondary">Vault</span></h1>
          <p className="text-slate-500 mt-2">
            {isLogin ? 'Welcome back! Login to your vault.' : 'Create your account to start earning.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input 
                type="text" 
                required
                className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none transition"
                placeholder="JohnDoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none transition"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input 
              type="password" 
              required
              className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-brand-secondary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition duration-300 shadow-lg"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-secondary hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
