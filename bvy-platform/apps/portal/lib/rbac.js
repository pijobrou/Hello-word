'use strict';

/**
 * Rôles et permissions : la seule correspondance rôle → permissions du portail.
 * Toute route vérifie une permission ; tout accès aux données d'un client passe par canAccessClient().
 */

const ROLES = Object.freeze({
  admin: 'Administrateur BVY',
  lead: 'Comptable principal',
  bookkeeper: 'Tenue de livres',
  payroll: 'Paie',
  tax: 'Fiscalité',
  client: 'Client',
});
const STAFF_ROLES = Object.freeze(['admin', 'lead', 'bookkeeper', 'payroll', 'tax']);

const PERMISSIONS = Object.freeze({
  admin: ['users.manage', 'users.invite_staff', 'users.invite_client', 'clients.manage', 'clients.view_all',
    'assignments.manage', 'audit.view', 'staff.workspace', 'mfa.reset'],
  lead: ['users.invite_client', 'clients.view_all', 'assignments.manage', 'audit.view', 'staff.workspace'],
  bookkeeper: ['staff.workspace', 'area.bookkeeping'],
  payroll: ['staff.workspace', 'area.payroll'],
  tax: ['staff.workspace', 'area.tax'],
  client: ['client.portal'],
});

function can(user, permission) {
  return Boolean(user && user.status === 'active' && (PERMISSIONS[user.role] || []).includes(permission));
}

// Accès aux données d'un client : le client lui-même, la direction (tous) ou le personnel assigné.
function canAccessClient(db, user, clientId) {
  if (!user || user.status !== 'active') return false;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) return false;
  if (user.role === 'client') return user.client_id === id;
  // La fiche interne du cabinet (son propre QuickBooks) est réservée à l'administrateur.
  const firm = db.prepare('SELECT is_firm FROM clients WHERE id = ?').get(id);
  if (firm && firm.is_firm) return user.role === 'admin';
  if (can(user, 'clients.view_all')) return true;
  if (STAFF_ROLES.includes(user.role)) {
    return Boolean(db.prepare('SELECT 1 FROM client_assignments WHERE user_id = ? AND client_id = ?').get(user.id, id));
  }
  return false;
}

// Liste des clients visibles par l'utilisateur.
function visibleClients(db, user) {
  if (!user || user.status !== 'active') return [];
  if (user.role === 'client') return db.prepare("SELECT * FROM clients WHERE id = ? AND status = 'active' AND is_firm = 0").all(user.client_id);
  if (can(user, 'clients.view_all')) return db.prepare("SELECT * FROM clients WHERE status = 'active' AND is_firm = 0 ORDER BY name").all();
  return db.prepare(`SELECT c.* FROM clients c JOIN client_assignments a ON a.client_id = c.id
    WHERE a.user_id = ? AND c.status = 'active' AND c.is_firm = 0 ORDER BY c.name`).all(user.id);
}

// Qui peut inviter quel rôle.
function canInviteRole(user, role) {
  if (!ROLES[role]) return false;
  if (role === 'client') return can(user, 'users.invite_client');
  return can(user, 'users.invite_staff');
}

module.exports = { ROLES, STAFF_ROLES, PERMISSIONS, can, canAccessClient, visibleClients, canInviteRole };
