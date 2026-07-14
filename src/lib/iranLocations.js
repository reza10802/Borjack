import { ostan, shahr } from "iran-cities-json";

export function getAllProvinces() {
  if (!Array.isArray(ostan)) return [];

  return ostan
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

export function getCitiesByProvinceId(provinceId) {
  if (!provinceId || !Array.isArray(shahr)) return [];

  const normalizedProvinceId = Number(provinceId);

  return shahr
    .filter(
      (item) =>
        item &&
        item.id &&
        item.name &&
        Number(item.ostan) === normalizedProvinceId
    )
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name),
      provinceId: Number(item.ostan),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

export function getProvinceById(provinceId) {
  const provinces = getAllProvinces();
  return (
    provinces.find((item) => Number(item.id) === Number(provinceId)) || null
  );
}

export function getCityById(cityId) {
  if (!cityId || !Array.isArray(shahr)) return null;

  const city = shahr.find((item) => Number(item.id) === Number(cityId));

  if (!city) return null;

  return {
    id: Number(city.id),
    name: String(city.name),
    provinceId: Number(city.ostan),
  };
}

export function validateProvinceCity(provinceId, cityId) {
  const province = getProvinceById(provinceId);

  if (!province) {
    return {
      valid: false,
      error: "استان انتخاب‌شده معتبر نیست",
      province: null,
      city: null,
    };
  }

  const city = getCityById(cityId);

  if (!city) {
    return {
      valid: false,
      error: "شهر انتخاب‌شده معتبر نیست",
      province: null,
      city: null,
    };
  }

  if (Number(city.provinceId) !== Number(province.id)) {
    return {
      valid: false,
      error: "شهر انتخاب‌شده متعلق به این استان نیست",
      province: null,
      city: null,
    };
  }

  return {
    valid: true,
    error: null,
    province,
    city,
  };
}