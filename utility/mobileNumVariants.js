function getMobilePhoneVariants(mobile) {
    const normalized = String(mobile).replace(/\D/g, '');

    if (!/^234\d{10}$/.test(normalized)) {
        throw new Error('Invalid Nigerian mobile number format');
    }

    const localNumber = normalized.substring(3);

    return [
        `+${normalized}`,  // +2348026023890
        normalized,        // 2348026023890
        `0${localNumber}`, // 08026023890
        localNumber        // 8026023890
    ];
}

export default getMobilePhoneVariants;