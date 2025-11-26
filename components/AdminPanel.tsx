import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getAllUsers, updateUserStatus, updateUserCredits, adminResetPassword, logout } from '../services/authService';

interface AdminPanelProps {
  currentUser: User;
  onLogout: () => void;
  onNavigateToApp: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, onLogout, onNavigateToApp }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("Error loading users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, status: 'approved' | 'pending' | 'blocked') => {
    try {
      const updated = await updateUserStatus(userId, status);
      setUsers(updated);
    } catch (error) {
      alert("Erro ao atualizar status.");
    }
  };

  const handleCreditsChange = async (userId: string, amount: number) => {
    try {
      const updated = await updateUserCredits(userId, amount);
      setUsers(updated);
    } catch (error) {
      alert("Erro ao atualizar créditos.");
    }
  };

  const handleResetPassword = async (userId: string) => {
    // Admin cannot change password directly in Supabase client without Service Key
    // So we trigger an email reset or notify.
    if (confirm("Confirmar envio de e-mail de redefinição de senha para este usuário?")) {
        try {
            const updated = await adminResetPassword(userId, ""); // Password arg ignored in new implementation
            alert("Solicitação enviada.");
        } catch (error) {
            alert("Erro ao resetar senha.");
        }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
               <span className="font-bold text-xl tracking-tight text-indigo-400">CorrectorAI</span>
               <span className="bg-indigo-600 text-xs px-2 py-1 rounded text-white font-bold uppercase">Admin</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={onNavigateToApp}
                className="text-sm bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors font-medium border border-slate-700"
              >
                Acessar App
              </button>
              <div className="h-6 w-px bg-slate-700 mx-2"></div>
              <span className="text-sm text-slate-300 hidden sm:inline">Olá, {currentUser.name}</span>
              <button onClick={onLogout} className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors">
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Usuários</h2>
            <button onClick={loadUsers} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              Atualizar Lista
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Usuário</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Créditos</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img src={user.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                        <div>
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                          {user.role === 'admin' && <span className="text-[10px] text-indigo-600 font-bold border border-indigo-200 px-1 rounded">ADMIN</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {user.role === 'admin' ? (
                         <span className="text-green-600 font-bold text-xs uppercase">Ativo</span>
                      ) : (
                        <select
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value as any)}
                          className={`text-sm font-medium px-2 py-1 rounded border outline-none ${
                            user.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                            user.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          <option value="pending">Pendente</option>
                          <option value="approved">Aprovado</option>
                          <option value="blocked">Bloqueado</option>
                        </select>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 w-12">{user.credits}</span>
                        {user.role !== 'admin' && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleCreditsChange(user.id, -1)}
                              className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold"
                            >
                              -
                            </button>
                            <button 
                              onClick={() => handleCreditsChange(user.id, 1)}
                              className="w-6 h-6 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 rounded text-indigo-600 font-bold"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                       <button
                         onClick={() => handleResetPassword(user.id)}
                         className="text-xs font-medium text-slate-500 hover:text-indigo-600 underline"
                       >
                         Resetar Senha (Email)
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;