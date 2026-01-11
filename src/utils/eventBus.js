const eventBus = new EventTarget();

export const emit = (type, detail) => {
  eventBus.dispatchEvent(new CustomEvent(type, { detail }));
};

export const on = (type, handler) => {
  eventBus.addEventListener(type, handler);
  return () => eventBus.removeEventListener(type, handler);
};

export default eventBus;
