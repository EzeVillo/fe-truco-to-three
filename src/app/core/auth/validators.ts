import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Valida que el campo contenga al menos `n` letras ASCII ([A-Za-z]).
 * Usado en register para el campo `username` (mínimo 3 letras).
 */
export function minLettersValidator(n: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    const letterCount = (value.match(/[A-Za-z]/g) ?? []).length;
    return letterCount >= n ? null : { minLetters: { required: n, actual: letterCount } };
  };
}

/**
 * Valida que el campo de contraseña contenga al menos 1 número y 1 símbolo.
 * Símbolo = cualquier carácter no alfanumérico y no-espacio.
 */
export const passwordStrengthValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: string = control.value ?? '';
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(value);

  if (!hasNumber && !hasSymbol) {
    return { passwordStrength: { missingNumber: true, missingSymbol: true } };
  }
  if (!hasNumber) {
    return { passwordStrength: { missingNumber: true } };
  }
  if (!hasSymbol) {
    return { passwordStrength: { missingSymbol: true } };
  }
  return null;
};
