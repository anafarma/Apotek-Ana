function afNow_() {
  return new Date();
}

function afFindActiveShift_(userId) {
  return afReadObjects_(AF_SHEET.SHIFT).find(row => {
    const id = afNormalizeText_(row.ID_User || row.UserId || row.userId);
    const status = afNormalizeText_(row.Status || row.status).toUpperCase();
    return id === afNormalizeText_(userId) && (status === 'AKTIF' || status === 'ACTIVE' || status === 'BUKA');
  }) || null;
}

function afShiftStatus_(actor) {
  const shift = afFindActiveShift_(actor.userId);
  return { active: !!shift, shift: shift };
}