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
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  
  // Initialize PeerJS
  useEffect(() => {
    if (mode !== 'landing') {
      // Clean up any existing peer
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      
      // Create a new peer with a random ID
      const peer = new Peer();
      
      peer.on('open', (id) => {
        setPeerId(id);
        console.log('My peer ID is: ' + id);
        setError(null);
      });
      
      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        setError(`Connection error: ${err.type}`);
        setConnectionStatus('disconnected');
      });
      
      // Handle incoming connections (for the sharing side)
      if (mode === 'share') {
        peer.on('connection', (conn) => {
          console.log('Incoming connection from:', conn.peer);
          connectionRef.current = conn;
          
          conn.on('open', () => {
            console.log('Connection opened with:', conn.peer);
            setConnectionStatus('connected'); // Set to connected immediately when connection opens
          });
          
          conn.on('close', () => {
            console.log('Connection closed');
            setConnectionStatus('disconnected');
            stopScreenShare();
          });
          
          conn.on('error', (err) => {
            console.error('Connection error:', err);
            setError(`Connection error: ${err}`);
          });
        });
        
        // Handle incoming calls
        peer.on('call', (call) => {
          console.log('Received call from:', call.peer);
          // Don't answer here, as we're the one sharing
        });
      }
      
      // For viewing mode
      if (mode === 'view') {
        peer.on('call', (call) => {
          console.log('Received call from sharer:', call.peer);
          callRef.current = call;
          
          // Answer the call without sending a stream back
          call.answer();
          
          call.on('stream', (remoteStream) => {
            console.log('Received stream from sharer');
            if (videoRef.current) {
              videoRef.current.srcObject = remoteStream;
            }
          });
          
          call.on('close', () => {
            console.log('Call closed');
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
            setConnectionStatus('disconnected');
          });
          
          call.on('error', (err) => {
            console.error('Call error:', err);
            setError(`Call error: ${err}`);
          });
        });
      }
      
      peerRef.current = peer;
      
      return () => {
        if (connectionRef.current) {
          connectionRef.current.close();
        }
        if (callRef.current) {
          callRef.current.close();
        }
        stopScreenShare();
        peer.destroy();
      };
    }
  }, [mode]);
  
  // Start screen sharing
  const startScreenShare = async () => {
    try {
      // Stop any existing stream
      stopScreenShare();
      
      console.log('Starting screen share...');
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // When sharing stops from browser controls
      mediaStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing ended by user');
        stopScreenShare();
      };
      
      // Send stream to viewer if connected
      if (connectionRef.current && connectionRef.current.open && peerRef.current) {
        console.log('Calling viewer:', connectionRef.current.peer);
        const call = peerRef.current.call(connectionRef.current.peer, mediaStream);
        callRef.current = call;
        
        call.on('error', (err) => {
          console.error('Call error:', err);
          setError(`Call error: ${err}`);
        });
      } else {
        console.log('Connection not ready yet, stream will be sent when viewer connects');
        setError('No viewer connected. Please wait for someone to connect before sharing.');
      }
    } catch (err) {
      console.error('Error getting screen:', err);
      setError('Failed to access screen. Please make sure you grant permission.');
    }
  };
  
  // Stop screen sharing
  const stopScreenShare = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
  };
  
  // Connect to a peer to view their screen
  const connectToPeer = () => {
    if (!remotePeerId || !peerRef.current) return;
    
    console.log('Connecting to peer:', remotePeerId);
    setConnectionStatus('connecting');
    setError(null);
    
    try {
      // Close any existing connection
      if (connectionRef.current) {
        connectionRef.current.close();
      }
      
      // Create a new connection
      const conn = peerRef.current.connect(remotePeerId, {
        reliable: true
      });
      
      connectionRef.current = conn;
      
      conn.on('open', () => {
        console.log('Connection opened to:', remotePeerId);
        setConnectionStatus('connected'); // Set to connected immediately when connection opens
      });
      
      conn.on('close', () => {
        console.log('Connection closed');
        setConnectionStatus('disconnected');
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
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
    if (peerId) {
      navigator.clipboard.writeText(peerId)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          setError('Failed to copy to clipboard');
        });
    }
  };
  
  // Disconnect from peer
  const disconnect = () => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    
    stopScreenShare();
    setConnectionStatus('disconnected');
    setMode('landing');
    setError(null);
    setRemotePeerId('');
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
          
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6 relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-contain"
            />
            
            {(!stream || connectionStatus !== 'connected') && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-4">
                  <Laptop className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">
                    {connectionStatus === 'disconnected' 
                      ? 'Waiting for viewer to connect...' 
                      : connectionStatus === 'connecting'
                      ? 'Connecting...'
                      : !stream
                      ? 'Click "Start Sharing" to begin'
                      : 'Sharing your screen'}
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
            {connectionStatus === 'connected' && !stream && (
              <button
                onClick={startScreenShare}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Start Sharing
              </button>
            )}
            {stream && (
              <button
                onClick={stopScreenShare}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Stop Sharing
              </button>
            )}
            <button
              onClick={disconnect}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              Disconnect
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <p className="font-medium mb-1">How to share your screen:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Copy your Connection ID and send it to the viewer</li>
              <li>Wait for the viewer to connect (status will change to "Connected")</li>
              <li>Click "Start Sharing" to begin sharing your screen</li>
            </ol>
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
          
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6 relative">
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
                      : 'Connecting... Waiting for screen share to start'}
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
          
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <p className="font-medium mb-1">How to view a screen:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Get the Connection ID from the person sharing their screen</li>
              <li>Enter the ID and click "Connect"</li>
              <li>Wait for the sharer to start sharing their screen</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;