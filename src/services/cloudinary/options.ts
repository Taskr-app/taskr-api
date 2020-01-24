/**
 * @desc - image transform options before storage
 */

export const eagerOptions = {
  width: 150,
  height: 150,
  crop: 'scale',
  format: 'jpg'
}

export const bytesLimit = 1024000
export const bytesError = 'The file you tried to upload was too large. Please upload a file smaller than 1024kb'