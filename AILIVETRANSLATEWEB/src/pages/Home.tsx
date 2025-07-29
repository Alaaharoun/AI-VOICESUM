import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, Upload, History, Globe, Zap, Shield, Users } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="bg-blue-600 p-4 rounded-full">
                <Mic className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Real-time Speech
              <span className="text-blue-600"> Translation</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your voice into text and translate it instantly. 
              Powered by advanced AI technology for accurate, real-time transcription and translation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/live-translation" className="btn-primary text-lg px-8 py-4">
                Start Live Translation
              </Link>
              <Link to="/upload" className="btn-secondary text-lg px-8 py-4">
                Upload Audio File
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need for seamless speech-to-text and translation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Processing</h3>
              <p className="text-gray-600">
                Get instant transcription and translation as you speak, with no delays or interruptions.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Globe className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">100+ Languages</h3>
              <p className="text-gray-600">
                Support for over 100 languages with accurate translation powered by Google Translate.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-purple-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure & Private</h3>
              <p className="text-gray-600">
                Your audio and transcriptions are encrypted and secure. We never store your data.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-orange-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Upload className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">File Upload</h3>
              <p className="text-gray-600">
                Upload audio files in multiple formats (MP3, WAV, M4A) for transcription and translation.
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <History className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">History & Export</h3>
              <p className="text-gray-600">
                Save your transcriptions and export them in various formats (TXT, DOC, RTF).
              </p>
            </div>

            <div className="card text-center">
              <div className="bg-indigo-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Users className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Team Collaboration</h3>
              <p className="text-gray-600">
                Share transcriptions with your team and collaborate on projects seamlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of users who trust LiveTranslate for their speech-to-text needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/sign-up" className="bg-white text-blue-600 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors">
              Sign Up Free
            </Link>
            <Link to="/live-translation" className="border-2 border-white text-white font-semibold py-3 px-8 rounded-lg hover:bg-white hover:text-blue-600 transition-colors">
              Try Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}; 