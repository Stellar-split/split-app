import { useState, useCallback } from 'react';

export function useInvoiceTags() {
  const [tags, setTags] = useState<string[]>([]);

  const addTag = useCallback((tag: string) => {
    setTags(prev => [...new Set([...prev, tag])]);
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const saveTags = useCallback(async (invoiceId: string) => {
    return true;
  }, [tags]);

  return { tags, setTags, addTag, removeTag, saveTags };
}
