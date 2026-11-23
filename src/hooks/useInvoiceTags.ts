import { useState, useCallback } from 'react';

export function useInvoiceTags() {
  const [tags, setTags] = useState<string[]>([]);
  const [tagsByInvoice, setTagsByInvoice] = useState<Record<string, string[]>>({});
  const [allTags, setAllTags] = useState<string[]>([]);

  const addTag = useCallback((tag: string) => {
    setTags(prev => [...new Set([...prev, tag])]);
    setAllTags(prev => [...new Set([...prev, tag])]);
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const saveTags = useCallback(async (invoiceId: string, tagsToSave?: string[]) => {
    const toSave = tagsToSave ?? tags;
    setTagsByInvoice(prev => ({ ...prev, [invoiceId]: toSave }));
    return true;
  }, [tags]);

  return { tags, setTags, addTag, removeTag, saveTags, tagsByInvoice, allTags, error: null };
}
