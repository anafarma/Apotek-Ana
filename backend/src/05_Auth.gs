function afNormalizeText_(value) {
  return String(value == null ? '' : value).trim();
}

function afFindUserForLogin_(identity) {
  const needle = afNormalizeText_(identity).toLowerCase();
  return afReadObjects_(AF_SHEET.USER).find(user => {
    return Object.keys(user).some(key => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized === 'iduser' || normalized === 'email' || normalized === 'username' || normalized === 'namauser') {
        return afNormalizeText_(user[key]).toLowerCase() === needle;
      }
      return false;
    });
  }) || null;
}

function afUserField_(user, aliases) {
  const key = Object.keys(user).find(header => aliases.indexOf(header.toLowerCase().replace(/[^a-z0-9]/g, '')) !== -1);
  return key ? user[key] : '';
}

function afAuthenticate_(identity, password) {
  const user = afFindUserForLogin_(identity);
  if (!user) return null;

  const storedPassword = afUserField_(user, ['password', 'kata sandi'.replace(/[^a-z0-9]/g, '')]);
  if (afNormalizeText_(storedPassword) !== String(password == null ? '' : password)) return null;

  const active = afUserField_(user, ['aktif', 'active']);
  if (active !== '' && String(active).toUpperCase() !== 'TRUE') return null;

  const roleRaw = afUserField_(user, ['role', 'peran']);
  const role = afNormalizeText_(roleRaw).toUpperCase() || 'PEGAWAI';

  return {
    userId: afUserField_(user, ['iduser', 'userid']),
    name: afUserField_(user, ['namauser', 'name']),
    role: role
  };
}

function afCreateSession_(actor) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('AF_SESSION_' + token, JSON.stringify(actor), 21600);
  return token;
}

function afGetSession_(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get('AF_SESSION_' + token);
  return raw ? JSON.parse(raw) : null;
}