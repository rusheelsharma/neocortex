import { useState } from 'react';
import CodeContextUI from './CodeContextUI';
import {
  validateAndGetUser,
  fetchRepos,
  analyzeRepo,
  askQuestion,
  setGitHubToken
} from './api';

export default function App() {
  const [currentRepo, setCurrentRepo] = useState<string | null>(null);

  return (
    <CodeContextUI
      onGitHubSignIn={async (token: string) => {
        setGitHubToken(token);
        return await validateAndGetUser(token);
      }}

      onFetchRepos={fetchRepos}

      onAnalyzeRepo={async (repoName: string) => {
        setCurrentRepo(repoName);
        return await analyzeRepo(repoName);
      }}

      onAskQuestion={async (question: string) => {
        if (!currentRepo) throw new Error('No repo selected');
        const result = await askQuestion(currentRepo, question, 2000);
        return { answer: result.answer, context: result.context };
      }}
    />
  );
}
