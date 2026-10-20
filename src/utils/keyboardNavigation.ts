import React from 'react';

export interface EnterKeyNavigationOptions {
  /**
   * Custom CSS selector for the form container if not inside a standard <form>
   */
  containerSelector?: string;
  /**
   * Custom CSS selector for the final submit / confirm button
   */
  submitButtonSelector?: string;
  /**
   * Callback fired before moving focus. Return false to prevent advancing.
   */
  onBeforeAdvance?: (currentEl: HTMLElement, nextEl: HTMLElement | null) => boolean | void;
}

/**
 * Handles Enter key navigation across form controls, advancing focus visually
 * instead of unexpectedly submitting the form.
 */
export function handleEnterKeyNavigation(
  e: React.KeyboardEvent<HTMLElement>,
  options?: EnterKeyNavigationOptions
): void {
  // Only intercept the Enter key
  if (e.key !== 'Enter') return;

  const target = e.target as HTMLElement;
  if (!target) return;

  // 1. If the user intentionally focused a button or link, let Enter activate it normally
  if (
    target.tagName === 'BUTTON' ||
    target.getAttribute('role') === 'button' ||
    target.tagName === 'A'
  ) {
    return;
  }

  // 2. Multiline textareas: standard Enter creates a newline for natural editing.
  // Ctrl+Enter or Cmd+Enter advances to the next field.
  if (target.tagName === 'TEXTAREA') {
    if (!e.ctrlKey && !e.metaKey) {
      return;
    }
  }

  // 3. Stop browser's default form submission
  e.preventDefault();

  // Find the containing form, modal, or custom root
  const rootContainer =
    (options?.containerSelector ? target.closest(options.containerSelector) : null) ||
    target.closest('form') ||
    target.closest('[role="dialog"]') ||
    document;

  const submitSelector = options?.submitButtonSelector || 'button[type="submit"]:not([disabled])';

  // Selector matching all visible, non-disabled, interactive controls
  const focusableSelector = [
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled]):not([readonly])',
    'select:not([disabled]):not([readonly])',
    'textarea:not([disabled]):not([readonly])',
    submitSelector,
  ].join(', ');

  const allElements = Array.from(rootContainer.querySelectorAll<HTMLElement>(focusableSelector));

  // Filter only visible elements that can receive focus
  const visibleElements = allElements.filter((el) => {
    if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
      return false;
    }
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    }
    if (el.getAttribute('tabindex') === '-1') {
      return false;
    }
    return true;
  });

  const currentIndex = visibleElements.indexOf(target);
  if (currentIndex === -1) {
    return;
  }

  // Support Shift+Enter to move backwards
  if (e.shiftKey) {
    if (currentIndex > 0) {
      const prevEl = visibleElements[currentIndex - 1];
      prevEl.focus();
      if (prevEl.tagName === 'INPUT' && typeof (prevEl as HTMLInputElement).select === 'function') {
        const inputType = (prevEl as HTMLInputElement).type;
        if (['text', 'number', 'tel', 'search', 'password'].includes(inputType)) {
          (prevEl as HTMLInputElement).select();
        }
      }
    }
    return;
  }

  // Normal Enter: move forwards
  if (currentIndex < visibleElements.length - 1) {
    const nextEl = visibleElements[currentIndex + 1];

    if (options?.onBeforeAdvance) {
      const allow = options.onBeforeAdvance(target, nextEl);
      if (allow === false) return;
    }

    nextEl.focus();
    if (nextEl.tagName === 'INPUT' && typeof (nextEl as HTMLInputElement).select === 'function') {
      const inputType = (nextEl as HTMLInputElement).type;
      if (['text', 'number', 'tel', 'search', 'password'].includes(inputType)) {
        (nextEl as HTMLInputElement).select();
      }
    }
  } else {
    // We are on the last field: focus the submit button if not already focused
    const submitBtn = rootContainer.querySelector<HTMLElement>(submitSelector);
    if (submitBtn && submitBtn !== target) {
      submitBtn.focus();
    }
  }
}
