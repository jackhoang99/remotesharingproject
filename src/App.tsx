import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Peer from 'peerjs';
import { Monitor, Share2, Eye, Shield, Copy, CheckCheck, Laptop } from 'lucide-react';

function App() {
  const [mode, setMode] = useState<'landing' | 'share' | 'view'>('landing');
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<any>(null);
  
  // Initialize PeerJS
  useEffect(() => {
    if (mode !== 'landing') {
      const peer = new Peer(uuidv4());
      
      peer.on('open', (id) => {
        setPeerId(id);
        console.log('My peer ID is: ' + id);
      });
      
      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        setError(`Connection error: ${err.type}`);
        setConnectionStatus('disconnected');
      });
      
      // Handle incoming connections (for the sharing side)
      if (mode === 'share') {
        peer.on('connection', (conn) => {
          connectionRef.current = conn;
          setConnectionStatus('connecting');
          
          conn.on('open', () => {
            setConnectionStatus('connected');
            startScreenShare();
          });
          
          conn.on('close', () => {
            setConnectionStatus('disconnected');
            stopScreenShare();
          });
        });
      }
      
      peerRef.current = peer;
      
      return () => {
        if (connectionRef.current) {
          connectionRef.current.close();
        }
        peer.destroy();
        stopScreenShare();
      };
    }
  }, [mode]);
  
  // Start screen sharing
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // When sharing stops from browser controls
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      // Send stream to viewer
      if (connectionRef.current && connectionRef.current.open) {
        const call = peerRef.current?.call(connectionRef.current.peer, stream);
        console.log('Sending stream to viewer', call);
      }
    } catch (err) {
      console.error('Error getting screen:', err);
      setError('Failed to access screen. Please make sure you grant permission.');
    }
  };
  
  // Stop screen sharing
  const stopScreenShare = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };
  
  // Connect to a peer to view their screen
  const connectToPeer = () => {
    if (!remotePeerId || !peerRef.current) return;
    
    setConnectionStatus('connecting');
    
    try {
      const conn = peerRef.current.connect(remotePeerId);
      connectionRef.current = conn;
      
      conn.on('open', () => {
        setConnectionStatus('connected');
        
        // Set up to receive the video stream
        peerRef.current?.on('call', (call) => {
          call.answer(); // Answer the call without sending a stream back
          
          call.on('stream', (remoteStream) => {
            if (videoRef.current) {
              videoRef.current.srcObject = remoteStream;
            }
          });
        });
      });
      
      conn.on('close', () => {
        setConnectionStatus('disconnected');
      });
      
      conn.on('error', (err) => {
        console.error('Connection error:', err);
        setError(`Connection error: ${err}`);
        setConnectionStatus('disconnected');
      });
    } catch (err) {
      console.error('Failed to connect:', err);
      setError(`Failed to connect: ${err}`);
      setConnectionStatus('disconnected');
    }
  };
  
  // Copy peer ID to clipboard
  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // Disconnect from peer
  const disconnect = () => {
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    stopScreenShare();
    setConnectionStatus('disconnected');
    setMode('landing');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      {/* Landing Page */}
      {mode === 'landing' && (
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <Monitor className="h-16 w-16 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Screen Connect</h1>
          <p className="text-gray-600 mb-8 text-center">
            Securely share your screen or view someone else's screen with consent.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => setMode('share')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="h-5 w-5" />
              Share My Screen
            </button>
            
            <button
              onClick={() => setMode('view')}
              className="w-full bg-white hover:bg-gray-50 text-indigo-600 font-medium py-3 px-4 rounded-lg border border-indigo-600 flex items-center justify-center gap-2 transition-colors"
            >
              <Eye className="h-5 w-5" />
              View Someone's Screen
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <Shield className="h-4 w-4" />
              <span>Secure peer-to-peer connection</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Share Screen Mode */}
      {mode === 'share' && (
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Share Your Screen</h2>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${
                connectionStatus === 'disconnected' ? 'bg-gray-300' :
                connectionStatus === 'connecting' ? 'bg-yellow-400' :
                'bg-green-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                {connectionStatus === 'disconnected' ? 'Waiting' :
                 connectionStatus === 'connecting' ? 'Connecting' :
                 'Connected'}
              </span>
            </div>
          </div>
          
          {peerId ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Connection ID
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={peerId}
                  readOnly
                  className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-l-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
                />
                <button
                  onClick={copyPeerId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-r-lg flex items-center justify-center transition-colors"
                >
                  {copied ? <CheckCheck className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Share this ID with the person who needs to view your screen
              </p>
            </div>
          ) : (
            <div className="flex justify-center my-6">
              <div className="animate-pulse text-indigo-600">Generating connection ID...</div>
            </div>
          )}
          
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-contain"
            />
            
            {connectionStatus !== 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-4">
                  <Laptop className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    {connectionStatus === 'disconnected' 
                      ? 'Waiting for viewer to connect...' 
                      : 'Connecting...'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={disconnect}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
      
      {/* View Screen Mode */}
      {mode === 'view' && (
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">View Screen</h2>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${
                connectionStatus === 'disconnected' ? 'bg-gray-300' :
                connectionStatus === 'connecting' ? 'bg-yellow-400' :
                'bg-green-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                {connectionStatus === 'disconnected' ? 'Disconnected' :
                 connectionStatus === 'connecting' ? 'Connecting' :
                 'Connected'}
              </span>
            </div>
          </div>
          
          {connectionStatus === 'disconnected' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter Connection ID
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={remotePeerId}
                  onChange={(e) => setRemotePeerId(e.target.value)}
                  placeholder="Paste the connection ID here"
                  className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-l-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
                />
                <button
                  onClick={connectToPeer}
                  disabled={!remotePeerId}
                  className={`px-4 py-2.5 rounded-r-lg flex items-center justify-center transition-colors ${
                    remotePeerId 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Connect
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Ask the person sharing their screen for their connection ID
              </p>
            </div>
          )}
          
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6">
            <video
              ref={videoRef}
              autoPlay
              className="w-full h-full object-contain"
            />
            
            {connectionStatus !== 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-4">
                  <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    {connectionStatus === 'disconnected' 
                      ? 'Enter a connection ID to view screen' 
                      : 'Connecting...'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={disconnect}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;